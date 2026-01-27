import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = 3001;

// SECURITY: Helmet for headers
app.use(helmet());

// SECURITY: Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// SECURITY: CORS (Allow all for DEV, restrict for PROD)
const isDev = process.env.NODE_ENV === 'development';
app.use(cors({
    origin: isDev ? '*' : process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Reduced form 50mb to 10mb for safety

// Global Error Handler (Middleware)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
        console.error(`[Server] Payload too large: ${err.length} bytes`);
        res.status(413).json({
            error: "Payload Too Large",
            message: "The request body is too large. Please try reducing the size of attachments or prompt content."
        });
        return; // Ensure we don't call next() after sending response
    }
    next(err);
});

// Add Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing on server");

        const genAI = new GoogleGenAI({ apiKey });

        const { model, contents, config } = req.body;

        const response = await genAI.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents,
            config: config || {}
        });

        res.json(response);
    } catch (error: any) {
        console.error("Proxy Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.post('/api/groq', async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error("API Key missing on server");

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
        res.json(data);

    } catch (error: any) {
        console.error("Groq Proxy Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
