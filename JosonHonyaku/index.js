import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

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

app.post("/translate", async (req, res) => {
    try {
        console.log("Translate request received");

        const { json, targetLang } = req.body;
        if (!json || !targetLang) {
            return res.status(400).json({ error: "invalid request body" });
        }

        const items = collectStrings(json);
        const cloned = structuredClone(json);

        for (const item of items) {
            const r = await fetch("https://translate.argosopentech.com/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    q: item.value,
                    source: "auto",
                    target: targetLang.toLowerCase(),
                    format: "text"
                })
            });

            const text = await r.text();
            console.log("LibreTranslate raw:", text);

            if (!r.ok) {
                throw new Error(`LibreTranslate error ${r.status}: ${text}`);
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error("JSON parse failed: " + text);
            }

            if (!data.translatedText) {
                throw new Error("No translatedText field");
            }

            setByPath(cloned, item.path, data.translatedText);
        }

        res.json({ translated: cloned });

    } catch (e) {
        console.error("TRANSLATE ERROR:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});


app.listen(3000, () => console.log("Server running"));
