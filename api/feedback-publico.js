module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "IsabelaBonsAchados@1";
  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: "KV não configurado." });

  const KEY = "feedbacks-pendentes";

  async function kvGet() {
    const r = await fetch(`${KV_URL}/get/${KEY}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    if (!d.result) return [];
    let value = d.result;
    while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } }
    if (Array.isArray(value) && typeof value[0] === "string") {
      try { value = JSON.parse(value[0]); } catch {}
    }
    return Array.isArray(value) ? value : [];
  }

  async function kvSet(value) {
    await fetch(`${KV_URL}/set/${KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([JSON.stringify(value)]),
    });
  }

  // Visitante envia feedback
  if (req.method === "POST" && !req.body.senha) {
    const { nome, texto, estrelas } = req.body;
    if (!nome || !texto) return res.status(400).json({ error: "Nome e texto obrigatórios." });
    const pendentes = await kvGet();
    pendentes.push({
      nome: nome.substring(0, 50),
      texto: texto.substring(0, 300),
      estrelas: estrelas || 5,
      data: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    });
    await kvSet(pendentes);
    return res.status(200).json({ success: true });
  }

  // Admin lista pendentes
  if (req.method === "GET") {
    const pendentes = await kvGet();
    return res.status(200).json({ pendentes });
  }

  // Admin deleta pendente
  if (req.method === "DELETE") {
    const { senha, index } = req.body;
    if (senha !== ADMIN_PASS) return res.status(401).json({ error: "Senha incorreta." });
    const pendentes = await kvGet();
    if (index >= 0 && index < pendentes.length) {
      pendentes.splice(index, 1);
      await kvSet(pendentes);
    }
    return res.status(200).json({ success: true, pendentes });
  }

  return res.status(405).json({ error: "Método não permitido" });
};
