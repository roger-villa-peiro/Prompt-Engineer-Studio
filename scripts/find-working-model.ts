
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function findWorkingModel() {
    console.log("----------------------------------------------------------------");
    console.log("🔍 GEMINI WORKING MODEL FINDER");
    console.log("----------------------------------------------------------------");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: GEMINI_API_KEY is missing in .env file");
        process.exit(1);
    }

    const genAI = new GoogleGenAI({ apiKey });

    // List of models to try - Round 2
    const modelsToTry = [
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash-thinking-exp",
        "gemini-1.5-flash-002",
        "gemini-1.5-pro-002",
        "gemini-1.5-flash-8b"
    ];

    console.log(`📋 Testing ${modelsToTry.length} models...`);

    for (const modelName of modelsToTry) {
        process.stdout.write(`👉 Testing '${modelName}'... `);
        try {
            const response = await genAI.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: "Hi" }] }],
            });

            console.log("✅ SUCCESS!");
            console.log(`🎉 Found working model: ${modelName}`);

            // Extract text to be sure
            try {
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    console.log(`   Response: "${text.trim()}"`);
                    console.log("\nRECOMMENDATION: Update aiConfig.ts to use this model.");
                    process.exit(0);
                }
            } catch (e) { }

            process.exit(0);

        } catch (error: any) {
            let status = "FAILED";
            let msg = error.message || "";

            // Parse JSON error if needed
            try {
                const parsed = JSON.parse(msg.replace(/^.*?{/, '{'));
                if (parsed.error) {
                    msg = parsed.error.message;
                    if (parsed.error.code) status = `FAILED (${parsed.error.code})`;
                }
            } catch (e) { }

            if (msg.includes("404") || msg.includes("not found")) status = "NOT FOUND";
            if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) status = "RATE LIMITED";
            if (msg.includes("403") || msg.includes("permission")) status = "PERMISSION DENIED";

            console.log(`❌ ${status}`);
        }
    }

    console.log("\n❌ ALL MODELS FAILED.");
    console.log("The API Key is valid (auth works), but no models accepted the request.");
    process.exit(1);
}

findWorkingModel();
