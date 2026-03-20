const crypto = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { link } = req.body;
  if (!link || typeof link !== "string")
    return res.status(400).json({ error: "Link inválido ou ausente." });

  const isShopee = link.includes("shopee.com.br") || link.includes("shope.ee") || link.includes("s.shopee");
  if (!isShopee) return res.status(400).json({ error: "Por favor, insira um link válido da Shopee." });

  const APP_ID = process.env.SHOPEE_APP_ID;
  const SECRET = process.env.SHOPEE_SECRET_KEY;
  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;

  if (!APP_ID || !SECRET) return res.status(500).json({ error: "Credenciais não configuradas." });

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const query = `mutation generateShortLink { generateShortLink(input: { originUrl: "${link}" }) { shortLink } }`;
    const body = JSON.stringify({ query });
    const signature = crypto.createHash("sha256").update(APP_ID + timestamp + body + SECRET).digest("hex");
    const authHeader = `SHA256 Credential=${APP_ID}, Signature=${signature}, Timestamp=${timestamp}`;

    const response = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body,
    });

    const data = await response.json();
    if (!data?.data?.generateShortLink?.shortLink)
      return res.status(500).json({ error: "A API da Shopee não retornou um link válido." });

    const convertedLink = data.data.generateShortLink.shortLink;

    if (KV_URL && KV_TOKEN) {
      try {
        const histRes = await fetch(`${KV_URL}/get/historico`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const histData = await histRes.json();
        let historico = [];
        if (histData.result) { try { historico = JSON.parse(histData.result); } catch {} }
        historico.unshift({
          link: convertedLink,
          data: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
        });
        if (historico.length > 50) historico = historico.slice(0, 50);
        await fetch(`${KV_URL}/set/historico`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify([JSON.stringify(historico)]),
        });
      } catch (e) { console.error("Historico error:", e); }
    }

    return res.status(200).json({ success: true, converted_link: convertedLink });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao converter link. Tente novamente." });
  }
};
