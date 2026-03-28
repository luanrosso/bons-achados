module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "IsabelaBonsAchados@1";
  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: "KV não configurado." });

  const KEYS = ["achados", "cupons", "relampago", "feedbacks", "cuponsLoja", "videos", "config", "cursoConfig", "cursos"];

  async function kvGet(key) {
    try {
      const r = await fetch(`${KV_URL}/get/site-${key}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      const d = await r.json();
      if (!d.result) return null;
      let value = d.result;
      while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } }
      if (Array.isArray(value) && typeof value[0] === "string") {
        try { value = JSON.parse(value[0]); } catch {}
      }
      return value;
    } catch (e) {
      return null;
    }
  }

  async function kvSet(key, value) {
    await fetch(`${KV_URL}/set/site-${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([JSON.stringify(value)]),
    });
  }

  if (req.method === "GET") {
    try {
      // Tentar ler chaves separadas primeiro
      const results = await Promise.all(KEYS.map(k => kvGet(k)));
      const data = {};
      let hasData = false;
      KEYS.forEach((k, i) => {
        if (results[i] !== null) {
          data[k] = results[i];
          hasData = true;
        }
      });

      // Se não tem dados nas chaves separadas, tentar ler chave antiga (migração)
      if (!hasData) {
        try {
          const oldR = await fetch(`${KV_URL}/get/site-dados`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` },
          });
          const oldD = await oldR.json();
          if (oldD.result) {
            let oldValue = oldD.result;
            while (typeof oldValue === "string") { try { oldValue = JSON.parse(oldValue); } catch { break; } }
            if (Array.isArray(oldValue)) { oldValue = oldValue[0]; while (typeof oldValue === "string") { try { oldValue = JSON.parse(oldValue); } catch { break; } } }
            if (oldValue && typeof oldValue === "object") {
              // Migrar dados antigos para chaves separadas
              for (const k of KEYS) {
                if (oldValue[k] !== undefined) {
                  await kvSet(k, oldValue[k]);
                  data[k] = oldValue[k];
                }
              }
              // Limpar chave antiga pra não usar mais
              try {
                await fetch(`${KV_URL}/del/site-dados`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${KV_TOKEN}` },
                });
              } catch (e) {}
              return res.status(200).json(data);
            }
          }
        } catch (e) {}
      }

      // Preencher campos faltantes com defaults
      const defaults = { achados:[], cupons:[], relampago:[], feedbacks:[], cuponsLoja:[], videos:[], config:{}, cursoConfig:{}, cursos:[] };
      for (const k of KEYS) {
        if (data[k] === undefined) data[k] = defaults[k];
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({ achados:[], cupons:[], relampago:[], feedbacks:[], cuponsLoja:[], videos:[], config:{}, cursoConfig:{}, cursos:[] });
    }
  }

  if (req.method === "POST") {
    const { senha, dados } = req.body;
    if (senha !== ADMIN_PASS) return res.status(401).json({ error: "Senha incorreta." });
    if (!dados) return res.status(400).json({ error: "Dados ausentes." });

    try {
      // Salvar cada chave separadamente
      const promises = [];
      for (const k of KEYS) {
        if (dados[k] !== undefined) {
          promises.push(kvSet(k, dados[k]));
        }
      }
      await Promise.all(promises);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erro ao salvar dados." });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
};
