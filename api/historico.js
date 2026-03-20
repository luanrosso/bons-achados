module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "IsabelaBonsAchados@1";

  function parseKV(result) {
    if (!result) return [];
    let value = result;
    while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } }
    if (Array.isArray(value)) {
      if (typeof value[0] === "string") { try { value = JSON.parse(value[0]); } catch {} }
      else { return value; }
    }
    return Array.isArray(value) ? value : [];
  }

  if (req.method === "GET") {
    try {
      const r = await fetch(`${KV_URL}/get/historico`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      return res.status(200).json({ historico: parseKV(d.result) });
    } catch (e) { return res.status(200).json({ historico: [] }); }
  }

  if (req.method === "DELETE") {
    const { senha } = req.body;
    if (senha !== ADMIN_PASS) return res.status(401).json({ error: "Senha incorreta." });
    await fetch(`${KV_URL}/del/historico`, { method: "POST", headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Método não permitido" });
};
