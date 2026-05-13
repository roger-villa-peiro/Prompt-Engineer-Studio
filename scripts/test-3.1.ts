import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

async function testModel(modelName: string) {
    try {
        console.log(`Testing ${modelName}...`);
        const response = await genAI.models.generateContent({
            model: modelName,
            contents: "Reply 'OK' if you receive this."
        });
        console.log(`✅ Success with ${modelName}:`, response.text);
    } catch (e: any) {
        console.error(`❌ Failed with ${modelName}:`, e.message);
    }
}

async function run() {
    await testModel("gemini-3.1-pro-preview");
    await testModel("gemini-3-flash-preview");
    await testModel("models/gemini-3.1-pro-preview");
    await testModel("models/gemini-3-flash-preview");
}
run();
