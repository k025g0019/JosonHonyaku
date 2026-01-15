import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const TRANSLATE_ENDPOINTS = [
    "https://translate.argosopentech.com/translate",
    "https://trans.zillyhuhn.com/translate",
    "https://lt.psf.lt/translate"
];

function collectStrings(obj, path = [], out = []) {
    if (typeof obj === "string") out.push({ path, value: obj });
    else if (Array.isArray(obj))
        obj.forEach((v, i) => collectStrings(v, [...path, i], out));
    else if (obj && typeof obj === "object")
        Object.entries(obj).forEach(([k, v]) =>
            collectStrings(v, [...path, k], out)
        );
    return out;
}

function setByPath(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
}

async function translateText(text, targetLang) {
    for (const url of TRANSLATE_ENDPOINTS) {
        try {
            const r = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    q: text,
                    source: "auto",
                    target: targetLang.toLowerCase(),
                    format: "text"
                })
            });

            const body = await r.text();
            if (!r.ok) continue;

            const data = JSON.parse(body);
            if (data.translatedText) return data.translatedText;
        } catch {
            // 次のミラーへ
        }
    }
    throw new Error("All translation endpoints failed");
}

app.post("/translate", async (req, res) => {
    try {
        const { json, targetLang } = req.body;
        if (!json || !targetLang) {
            return res.status(400).json({ error: "invalid request" });
        }

        const items = collectStrings(json);
        const cloned = structuredClone(json);

        for (const item of items) {
            const translated = await translateText(item.value, targetLang);
            setByPath(cloned, item.path, translated);
        }

        res.json({ translated: cloned });
    } catch (e) {
        console.error("TRANSLATE ERROR:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});

app.get("/", (_, res) => {
    res.send("JSON翻訳サーバー稼働中");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
