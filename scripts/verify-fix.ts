
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyFix() {
    console.log("----------------------------------------------------------------");
    console.log("🔍 FINAL VERIFICATION (gemini-2.0-flash-lite)");
    console.log("----------------------------------------------------------------");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        process.exit(1);
    }

    const genAI = new GoogleGenAI({ apiKey });

    try {
        console.log("📡 Sending test request...");
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-lite',
            contents: [{ role: 'user', parts: [{ text: "Respond with 'SYSTEM OPERATIONAL'" }] }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text && text.includes("SYSTEM OPERATIONAL")) {
            console.log("✅ SUCCESS: System is operational with new model.");
            console.log(`📝 Response: "${text.trim()}"`);
            process.exit(0);
        } else {
            console.log("⚠️ RESPONSE RECEIVED but unexpected content:");
            console.log(text);
            process.exit(0);
        }

    } catch (error: any) {
        console.error("❌ FAILURE during final verification.");
        console.error(error.message);
        process.exit(1);
    }
}

verifyFix();
