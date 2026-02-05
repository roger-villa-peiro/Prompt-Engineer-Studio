
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing in .env file");
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

const MODELS_TO_TEST = [
    // Production Ready
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',

    // Preview / Experimental
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',

    // Image Generation (Nano Banana series)
    'gemini-3-pro-image-preview',    // Nano Banana Pro
    'gemini-2.5-flash-image-preview', // Nano Banana

    // Deprecated / Legacy
    'gemini-2.0-flash-lite',
];

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testModel(modelId: string) {
    console.log(`\n🧪 Testing model: ${modelId}...`);
    try {
        // Special Handling for Image Models
        if (modelId.includes('image')) {
            console.log("   (Image Model - Attempting simple generation)");
            const response = await genAI.models.generateContent({
                model: modelId,
                contents: [{
                    role: 'user',
                    parts: [{ text: "Draw a small red apple in pixel art style." }]
                }],
                config: {
                    // Image models might not support maxOutputTokens the same way or default to image count
                }
            });

            // Check if we got any candidates, even without text
            if (response && response.candidates && response.candidates.length > 0) {
                console.log(`✅ SUCCESS: ${modelId} responded with candidates.`);
                // Log parts to see what we got (likely inlineData)
                response.candidates[0].content?.parts?.forEach((part: any, i: number) => {
                    if (part.text) console.log(`   Part ${i} (Text): ${part.text.substring(0, 50)}...`);
                    if (part.inlineData) console.log(`   Part ${i} (Image): MIME=${part.inlineData.mimeType}, Size=${part.inlineData.data?.length}`);
                });
                return true;
            } else {
                console.log(`⚠️ SUCCESSish: ${modelId} returned no candidates but no error.`);
                return false;
            }

        } else {
            // Standard Text/Multimodal Models
            const response = await genAI.models.generateContent({
                model: modelId,
                contents: [{
                    role: 'user',
                    parts: [{ text: "Hello, just say 'OK' if you can hear me." }]
                }],
                config: {
                    temperature: 0.1,
                    maxOutputTokens: 500
                }
            });

            let success = false;
            let outputText = "";

            if (response && response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];
                // Check for generic 'content', handling potentially missing parts
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    outputText = candidate.content.parts.map((p: any) => p.text).join('') || "";
                    success = true;
                }
            }

            if (success) {
                console.log(`✅ SUCCESS: ${modelId} responded with: "${outputText.trim()}"`);
                return true;
            } else {
                console.log(`⚠️ RECEIVED RESPONSE BUT NO CONTENT: ${modelId}`);
                console.log(JSON.stringify(response, null, 2));
                return false;
            }
        }

    } catch (error: any) {
        console.log(`❌ FAILED: ${modelId}`);
        // Handle 429 specially
        if (error.message && error.message.includes('429')) {
            console.log(`   Error: Quota/Rate Limit exceeded (429). Model exists but busy/limited.`);
            return true;
        }
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log("🚀 Starting Gemini Model Connectivity Tests...");
    console.log("---------------------------------------------");

    let passed = 0;
    let failed = 0;

    for (const model of MODELS_TO_TEST) {
        const result = await testModel(model);
        if (result) passed++;
        else failed++;
        await sleep(2000);
    }

    console.log("\n---------------------------------------------");
    console.log(`🏁 Test Summary:`);
    console.log(`✅ Valid Model IDs: ${passed}`);
    console.log(`❌ Invalid/Failed: ${failed}`);
    console.log("---------------------------------------------");
}

runTests();
