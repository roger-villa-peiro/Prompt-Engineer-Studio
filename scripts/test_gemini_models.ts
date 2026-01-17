
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
import { fileURLToPath } from 'url';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

console.log(`Checking env at: ${envPath}`);

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/GEMINI_API_KEY=(.*)/);
    if (match) {
        process.env.GEMINI_API_KEY = match[1].trim();
        console.log("Found GEMINI_API_KEY in .env");
    } else {
        console.log("GEMINI_API_KEY not found in .env content");
    }
} else {
    console.error(".env file does NOT exist at path");
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("NO API KEY FOUND. Checked: GEMINI_API_KEY, API_KEY, VITE_API_KEY, GOOGLE_API_KEY");
    console.log("Current Env Keys:", Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('API')));
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const CANDIDATES = [
    "gemini-2.5-pro",           // User hypothesis
    "models/gemini-2.5-pro",
    "gemini-2.0-pro-exp-02-05", // The one that failed
    "gemini-1.5-pro",           // Stable
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-002",
    "gemini-2.0-flash-exp",     // Experimental Flash
    "gemini-2.0-flash",
    "gemini-pro-experimental",
    "models/gemini-1.5-pro"
];

async function testModel(modelId: string) {
    process.stdout.write(`Testing ${modelId}... `);
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts: [{ text: "Hello" }] }]
        });
        console.log("✅ SUCCESS");
        return true;
    } catch (e: any) {
        console.log("❌ FAILED");
        // console.log(e.message); // Accessing message safely?
        return false;
    }
}

async function run() {
    console.log("Checking available Gemini models...");

    // First, try to list models if permitted
    /*
    try {
       // Note: listModels might not be available in all SDK versions or keys
       // const models = await ai.getModels(); 
       // console.log("Available Models:", models);
    } catch(e) {} 
    */

    for (const id of CANDIDATES) {
        await testModel(id);
    }
}

run();
