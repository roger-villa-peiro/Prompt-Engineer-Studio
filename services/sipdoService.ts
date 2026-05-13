import { callGemini, safeJsonParse } from "./geminiService";
import { logger } from "./loggerService";
import { z } from "zod";

export interface StressResult {
    passed: boolean;
    score: number;
    failures: FailureCase[];
    summary: string;
}

export interface FailureCase {
    input: string;
    expected: string;
    actual: string;
    reason: string;
    expected_behavior_description?: string;
}

/**
 * SIPDO: Scientific Integrated Prompt Design Optimization
 * Module for generating adversarial stress tests and self-patching prompts.
 */

// Schema Definitions
const StressTestSchema = z.array(z.string());
const VerdictSchema = z.object({
    passed: z.boolean(),
    reason: z.string(),
    expected_behavior_description: z.string().optional()
});
const ProgressiveTestsSchema = z.array(z.object({
    type: z.enum(['Simple', 'Complex', 'Edge Case']),
    input: z.string()
}));

// 1. Generate Stress Tests (Adversarial)
export async function generateStressTests(prompt: string, n: number = 3): Promise<string[]> {
    const systemPrompt = `You are a QA Engineer specialized in breaking LLM prompts.
    Analyze the following prompt and generate ${n} "Red Teaming" inputs designed to make it fail.
    
    Focus on:
    - Ambiguity/Edge cases
    - Injection attacks (ignore if prompt is not security-critical, but good to test)
    - Conflicting instructions
    - Unexpected format inputs
    
    OUTPUT: A JSON array of strings. Each string is a raw input to test against the prompt.
    Example: ["input 1", "input 2"]
    `;

    const userPrompt = `PROMPT TO TEST:
    ${prompt}
    
    Generate ${n} challenging inputs.`;

    try {
        const response = await callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: "gemini-3-flash-preview", // Fast model for generation
            temperature: 0.7,
            jsonMode: true
        });

        return safeJsonParse(response, StressTestSchema);
    } catch (e) {
        logger.error("Failed to generate stress tests", e);
        return ["Test Case 1: Generic Input", "Test Case 2: Edge Case Input"];
    }
}

// 2. Evaluate Prompt Against Tests
export async function evaluateAgainstTests(prompt: string, tests: string[]): Promise<StressResult> {
    const failures: FailureCase[] = [];
    let passedCount = 0;

    for (const testInput of tests) {
        // Run the prompt
        let actualOutput = "";
        try {
            actualOutput = await callGemini({
                prompt: testInput,
                systemInstruction: prompt,
                model: "gemini-3-flash-preview", // Use fast model for testing
                temperature: 0.1
            });
        } catch (e) {
            actualOutput = "ERROR: Model failed to respond.";
        }

        // Judge the output
        const judgeSystemPrompt = `You are an impartial Judge. Evaluate if the Output followed the System Instruction correctly.`;

        const judgeUserPrompt = `
        PROMPT SYSTEM INSTRUCTION: ${prompt}
        TEST INPUT: ${testInput}
        ACTUAL OUTPUT: ${actualOutput}

        Did the Output follow the System Instruction correctly?
        If NO, explain why.

        FORMAT (JSON):
        {
            "passed": boolean,
            "reason": "explanation if failed, else 'OK'",
            "expected_behavior_description": "short description of what should have happened"
        }
        `;

        try {
            const judgeRes = await callGemini({
                prompt: judgeUserPrompt,
                systemInstruction: judgeSystemPrompt,
                model: "gemini-3-flash-preview",
                jsonMode: true
            });

            const verdict = safeJsonParse(judgeRes, VerdictSchema);

            if (verdict.passed) {
                passedCount++;
            } else {
                failures.push({
                    input: testInput,
                    actual: actualOutput,
                    expected: verdict.expected_behavior_description || "Correct adherence to instructions",
                    reason: verdict.reason
                });
            }
        } catch (e) {
            // Assume pass if judge fails? Or fail? Let's assume fail to be safe.
            failures.push({
                input: testInput,
                actual: actualOutput,
                expected: "Valid response",
                reason: "Judge failed to evaluate"
            });
        }
    }

    const score = Math.round((passedCount / tests.length) * 100);

    return {
        passed: score === 100,
        score,
        failures,
        summary: `Passed ${passedCount}/${tests.length} stress tests.`
    };
}

// 3. Patch Prompt from Failures
export async function patchPromptFromFailures(prompt: string, failures: FailureCase[]): Promise<string> {
    if (failures.length === 0) return prompt;

    const systemPrompt = `You are a Senior Prompt Engineer.
    The current prompt failed specific stress tests.
    Your goal is to PATCH the prompt to handle these cases without breaking existing functionality.
    
    RETURN ONLY THE FULL CORRECTED PROMPT. NO MARKDOWN. NO EXPLANATION.`;

    const failureText = failures.map((f, i) => `
    FAILURE ${i + 1}:
    Input: ${f.input}
    Output: ${f.actual}
    Expected: ${f.expected}
    Reason: ${f.reason}
    `).join("\n");

    const userPrompt = `
    CURRENT PROMPT:
    ${prompt}

    FAILURES TO FIX:
    ${failureText}

    Rewrite the prompt to prevent these failures.
    `;

    try {
        const patched = await callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: "gemini-3-flash-preview", // Smart model for patching -> maybe Pro? Keep Flash for speed/cost.
            temperature: 0.3
        });
        return patched.trim();
    } catch (e) {
        logger.error("Failed to patch prompt", e);
        return prompt;
    }
}

export interface SIPDOTestCase {
    type: 'Simple' | 'Complex' | 'Edge Case';
    input: string;
}

export const sipdoService = {
    async generateProgressiveTests(promptA: string, promptB: string, difficulty: number): Promise<SIPDOTestCase[]> {
        const systemPrompt = `You are a QA Lead. Generate a test suite for two LLM prompts.
        Create ${difficulty + 2} test cases ranging from Simple to Edge Cases.
        
        OUTPUT JSON:
        [
            { "type": "Simple", "input": "..." },
            { "type": "Complex", "input": "..." },
            { "type": "Edge Case", "input": "..." }
        ]
        `;

        try {
            const response = await callGemini({
                prompt: `Generate test suite for comparison:\nPROMPT A: ${promptA.substring(0, 500)}\nPROMPT B: ${promptB.substring(0, 500)}`,
                systemInstruction: systemPrompt,
                model: "gemini-3-flash-preview",
                jsonMode: true
            });
            const parsed = safeJsonParse(response, ProgressiveTestsSchema);
            return parsed;
        } catch (e) {
            logger.error("SIPDO generateProgressiveTests failed", e);
            return [
                { type: 'Simple', input: 'Basic test request' },
                { type: 'Complex', input: 'Complex request with multiple constraints' },
                { type: 'Edge Case', input: 'Empty or malformed input' }
            ] as SIPDOTestCase[];
        }
    }
};
