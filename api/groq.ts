import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Gemini-Api-Key, X-Groq-Api-Key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = req.headers['x-groq-api-key'] as string || process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: "API Key missing. Please configure your Groq API Key in the settings." });
        }

        const { model, messages, temperature, max_tokens } = req.body;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || "llama-3.3-70b-versatile",
                messages,
                temperature: temperature ?? 0.7,
                max_tokens,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Groq Function Error:", error);
        return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}
