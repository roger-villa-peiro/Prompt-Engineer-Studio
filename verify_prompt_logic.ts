
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env properly
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// Map GEMINI_API_KEY to API_KEY if needed
if (process.env.GEMINI_API_KEY && !process.env.API_KEY) {
    console.log("Mapping GEMINI_API_KEY to API_KEY for verification...");
    process.env.API_KEY = process.env.GEMINI_API_KEY;
}

// Mock localStorage BEFORE importing services
console.log("Setting up localStorage mock...");
const mockStorage = {
    getItem: (key: string) => null,
    setItem: (key: string, value: string) => { },
    removeItem: (key: string) => { },
    clear: () => { },
    length: 0,
    key: (index: number) => null,
};
(global as any).localStorage = mockStorage;

async function verify() {
    console.log("Starting verification of Prompt Logic Upgrade...");

    // Dynamic import to ensure mock is present when service loads
    const { optimizePrompt } = await import('./services/geminiService');

    const input = "Refactor the following React component to use hooks: `class MyComp extends React.Component { render() { return <div>{this.props.name}</div> } }`";

    try {
        const result: any = await optimizePrompt(input);

        if ('status' in result && result.status === 'NEEDS_CLARIFICATION') {
            console.log("Unexpected: Needs clarification.");
            console.log(JSON.stringify(result, null, 2));
            return;
        }

        if ('refinedPrompt' in result) {
            console.log("\n--- Thinking Process ---");
            console.log(result.metadata.thinkingProcess);

            console.log("\n--- Refined Prompt ---");
            console.log(result.refinedPrompt);

            console.log("\n--- Verification Checks ---");
            // Check for Framework selection
            const tp = result.metadata.thinkingProcess;
            const hasFramework = tp.includes("RTF") || tp.includes("COT") || tp.includes("TAG");
            console.log(`[${hasFramework ? 'PASS' : 'FAIL'}] Thinking Process selects framework (found: ${hasFramework})`);

            // Check for Rigid Structure
            const prompt = result.refinedPrompt;
            const hasRole = prompt.includes("ROL") || prompt.includes("ROLE");
            const hasConstraints = prompt.includes("LIMITACIONES") || prompt.includes("CONSTRAINTS");
            const hasFormat = prompt.includes("FORMATO") || prompt.includes("OUTPUT"); // Loose check for variations

            console.log(`[${hasRole ? 'PASS' : 'FAIL'}] Contains ROLE/ROL`);
            console.log(`[${hasConstraints ? 'PASS' : 'FAIL'}] Contains LIMITACIONES/CONSTRAINTS`);
            console.log(`[${hasFormat ? 'PASS' : 'FAIL'}] Contains FORMATO/OUTPUT`);
        } else {
            console.log("Unknown result structure:", result);
        }

    } catch (error) {
        console.error("Verification failed with error:", error);
        if (error instanceof Error) {
            console.error(error.message);
        }
    }
}

verify();
