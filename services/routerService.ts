import { callGemini, safeJsonParse } from "./geminiService";
import { z } from "zod";

export const RouterResponseSchema = z.object({
    mode: z.enum(['CHAT', 'SPEC', 'TEST']),
    subType: z.enum(['CODING', 'PLANNING', 'WRITING', 'GENERAL']).optional(),
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

Your job is to classify the user's intent based on their conversation history into one of three main categories, and if SPEC, a sub-category.

1. **CHAT**: Casual conversation, simple questions, greetings.
2. **SPEC**: Requests to CREATE, REFINE, OPTIMIZE, or EVALUATE a prompt or specification. "Heavy Lifting".
3. **TEST**: Requests to run code, playground, or test variables.

### SPEC Sub-Types (The Specialist Injection)
If the mode is **SPEC**, you MUST classify the \`subType\`:

*   **CODING**: Writing code, refactoring, fixing bugs, React, TypeScript, Scripts.
*   **PLANNING**: Architectural design, roadmaps, master plans, file structures.
*   **WRITING**: Copywriting, content generation, email drafting.
*   **GENERAL**: Everything else (Analysis, Brainstorming).

Return ONLY a JSON object.

### Examples
- "Fix this bug in my React component" -> { "mode": "SPEC", "subType": "CODING", "confidence": 0.99 }
- "Plan a roadmap for a generic app" -> { "mode": "SPEC", "subType": "PLANNING", "confidence": 0.98 }
- "Write an email to my boss" -> { "mode": "SPEC", "subType": "WRITING", "confidence": 0.95 }
- "Hello there" -> { "mode": "CHAT", "confidence": 0.99 }

IMPORTANT: Respond ONLY with a JSON object. No markdown.
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
