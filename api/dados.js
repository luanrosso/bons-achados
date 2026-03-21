module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "IsabelaBonsAchados@1";
  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: "KV não configurado." });

  if (req.method === "GET") {
    try {
      const r = await fetch(`${KV_URL}/get/site-dados`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      const d = await r.json();
      if (!d.result) return res.status(200).json({ achados: [], cupons: [], relampago: [], feedbacks: [] });
      let value = d.result;
      while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } }
      if (Array.isArray(value)) { value = value[0]; while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } } }
      return res.status(200).json(value);
    } catch (e) {
      return res.status(200).json({ achados: [], cupons: [], relampago: [], feedbacks: [] });
    }
  }

  if (req.method === "POST") {
    const { senha, dados } = req.body;
    if (senha !== ADMIN_PASS) return res.status(401).json({ error: "Senha incorreta." });
    if (!dados) return res.status(400).json({ error: "Dados ausentes." });

    try {
      await fetch(`${KV_URL}/set/site-dados`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([JSON.stringify(dados)]),
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erro ao salvar dados." });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
};
