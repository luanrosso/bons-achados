module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "IsabelaBonsAchados@1";
  const KV_URL = process.env.UPSTASH_KV_REST_API_URL;
  const KV_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN;
  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

  async function kvGet() {
    if (!KV_URL || !KV_TOKEN) return null;
    const r = await fetch(`${KV_URL}/get/cupom`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    if (!d.result) return null;
    let value = d.result;
    while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } }
    if (Array.isArray(value)) { value = value[0]; while (typeof value === "string") { try { value = JSON.parse(value); } catch { break; } } }
    return value;
  }

  async function kvSet(value) {
    if (!KV_URL || !KV_TOKEN) return;
    await fetch(`${KV_URL}/set/cupom`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([JSON.stringify(value)]),
    });
  }

  if (req.method === "GET") {
    const data = await kvGet();
    return res.status(200).json(data || { ativo: false, imagem: null });
  }

  if (req.method === "POST") {
    const { senha, ativo, imagem, uploadImagem, fileType } = req.body;
    if (senha !== ADMIN_PASS) return res.status(401).json({ error: "Senha incorreta." });

    if (uploadImagem && BLOB_TOKEN) {
      try {
        const base64Data = uploadImagem.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const name = `cupom-${Date.now()}.${fileType || "jpeg"}`;
        const blobRes = await fetch(`https://blob.vercel-storage.com/${name}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${BLOB_TOKEN}`, "Content-Type": `image/${fileType || "jpeg"}`, "x-api-version": "7" },
          body: buffer,
        });
        const blobData = await blobRes.json();
        if (blobData.url) {
          const newState = { ativo: true, imagem: blobData.url };
          await kvSet(newState);
          return res.status(200).json({ success: true, ...newState });
        }
      } catch (err) {
        return res.status(500).json({ error: "Erro ao fazer upload da imagem." });
      }
    }

    const newState = { ativo: !!ativo, imagem: imagem || null };
    await kvSet(newState);
    return res.status(200).json({ success: true, ...newState });
  }

  return res.status(405).json({ error: "Método não permitido" });
};
