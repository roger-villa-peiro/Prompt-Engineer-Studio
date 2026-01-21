import { callGemini, safeJsonParse } from "./geminiService";
import { z } from "zod";

export const RouterResponseSchema = z.object({
    mode: z.enum(['CHAT', 'SPEC', 'TEST']),
    confidence: z.number().min(0).max(1),
});

export type RouterResponse = z.infer<typeof RouterResponseSchema>;

/**
 * ROUTER SERVICE (The Front Door)
 * Classifies user intent to avoid expensive Architect/Judge calls for simple queries.
 */
export const classifyIntent = async (
    userMessage: string,
    historyContext: string
): Promise<RouterResponse> => {

    const SYSTEM_PROMPT = `
You are an intent classifier for a language model.

Your job is to classify the user's intent based on their conversation history into one of three main categories:

1. **CHAT**: Casual conversation, simple questions, greetings, or short functional queries ("Hi", "Thanks", "What is an LLM?").
2. **SPEC**: Requests to CREATE, REFINE, OPTIMIZE, or EVALUATE a prompt or specification. This is the "Heavy Lifting" mode.
3. **TEST**: Requests to run code, use the playground, or test a specific variable/output.

Return ONLY a JSON object with 2 properties: "mode" and "confidence".

### Category Definitions

#### 1. CHAT (Lightweight)
- General knowledge questions.
- Greetings / Politeness.
- Clarifications that don't need a full prompt re-write.

#### 2. SPEC (Heavyweight - Architect)
- "Create a prompt for..."
- "Refine this..."
- "Judge this..."
- "Optimize for Llama..."
- "Make this better..."

#### 3. TEST (Execution)
- "Run this..."
- "Test with X..."
- "Show me the playground..."

IMPORTANT: Respond ONLY with a JSON object. No markdown, no fences.
Example: { "mode": "SPEC", "confidence": 0.98 }
`;

    try {
        const response = await callGemini({
            prompt: `HISTORY:\n${historyContext}\n\nLAST MESSAGE: ${userMessage}`,
            systemInstruction: SYSTEM_PROMPT,
            model: "gemini-2.0-flash", // Use fast/cheap model for routing
            jsonMode: true,
            temperature: 0.1
        });

        return safeJsonParse(response, RouterResponseSchema);

    } catch (error) {
        console.warn("Router Classification Failed, defaulting to SPEC mode for safety.", error);
        // Fallback to Spec mode to ensure we don't miss complex requests
        return { mode: 'SPEC', confidence: 0.0 };
    }
};
