
import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyAyrmnYwVsqPodWrCJuZNwaVkjX1wTX3uM";
const client = new GoogleGenAI({ apiKey });

async function testModel(modelId: string) {
    process.stdout.write(`Testing '${modelId.padEnd(25)}' ... `);
    try {
        const response = await client.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts: [{ text: 'Ping' }] }]
        });
        console.log("✅ AVAILABLE");
    } catch (e: any) {
        if (e.message.includes("404") || e.message.includes("not found")) {
            console.log("❌ NOT FOUND (404)");
        } else {
            console.log("❌ ERROR: " + e.message.substring(0, 50));
        }
    }
}

async function compareFlash() {
    console.log("⚡ FLASH GENERATION CHECK ⚡\n");

    // Gen 2.5 (Control)
    await testModel('gemini-2.5-flash');

    // Gen 3 (Target)
    await testModel('gemini-3-flash');
    await testModel('gemini-3.0-flash');
    await testModel('gemini-3-flash-preview');
    await testModel('gemini-3.0-flash-preview');
    await testModel('gemini-3-flash-exp');
}

compareFlash();
