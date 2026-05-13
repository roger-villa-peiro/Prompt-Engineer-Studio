
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listModels() {
    console.log("----------------------------------------------------------------");
    console.log("🔍 GEMINI MODEL LIST UTILITY");
    console.log("----------------------------------------------------------------");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ ERROR: GEMINI_API_KEY is missing in .env file");
        process.exit(1);
    }

    console.log(`🔑 Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log("📡 Connecting to Gemini API to list models...");

    try {
        const genAI = new GoogleGenAI({ apiKey });

        // List models
        const response = await genAI.models.list();

        console.log("✅ API CALL SUCCESSFUL");
        console.log("📦 Available Models:");

        if ((response as any).models) {
            (response as any).models.forEach((model: any) => {
                console.log(`   - ${model.name} (${model.displayName})`);
            });
        } else {
            console.log("   (No models list returned in standard format)");
            console.log(JSON.stringify(response, null, 2));
        }

    } catch (error: any) {
        console.error("❌ FAILURE: Could not list models.");
        console.error(`🔴 Error: ${error.message}`);
        process.exit(1);
    }
}

listModels();
