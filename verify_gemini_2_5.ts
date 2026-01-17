
import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyAyrmnYwVsqPodWrCJuZNwaVkjX1wTX3uM";
const client = new GoogleGenAI({ apiKey });

async function testModel(modelId: string) {
    process.stdout.write(`Testing '${modelId}'... `);
    try {
        const response = await client.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts: [{ text: 'Ping' }] }]
        });
        console.log("✅ OK");
        return true;
    } catch (e: any) {
        if (e.message.includes("404") || e.message.includes("not found")) {
            console.log("❌ NOT FOUND (404)");
        } else {
            console.log("❌ FAILED: " + e.message.substring(0, 100));
        }
        return false;
    }
}

async function runChecks() {
    console.log("🔍 Verifying Gemini 2.5 Models:\n");
    await testModel('gemini-2.5-flash');
    await testModel('gemini-2.5-flash-latest');
    await testModel('models/gemini-2.5-flash');
}

runChecks();
