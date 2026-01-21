import { callGemini, safeJsonParse } from "./geminiService";
import { EVOLUTIONARY_BIOLOGIST_PROMPT } from "../config/systemPrompts";
import { z } from "zod";

interface EvolutionParams {
    winnerPrompt: string;
    loserPrompt: string;
    judgeReasoning: string;
    failedCases?: string[]; // Optional: List of inputs that caused failure
    history?: { version: string, message?: string }[]; // Trajectory
}

export interface EvolutionResult {
    master_mutation: {
        logic: string;
        mutation: string;
    };
}

const EvolutionSchema = z.object({
    evolution_logic: z.string(),
    mutated_prompt: z.string(),
    genetic_diff: z.array(z.string())
});

export const OptimizerService = {
    /**
     * Evolves a winning prompt into a superior version using Judge's feedback.
     */
    async evolvePrompt(params: EvolutionParams): Promise<EvolutionResult> {
        const { winnerPrompt, loserPrompt, judgeReasoning, failedCases = [], history = [] } = params;

        // Serialize history for the prompt
        const historyContext = history.length > 0
            ? history.map(h => `[Previous Interaction]: ${h.message}\n(Version ${h.version})`).join('\n\n')
            : "No previous trajectory.";

        const prompt = `
        ${EVOLUTIONARY_BIOLOGIST_PROMPT}

        --- CONTEXT DATA ---
        
        [WINNER PROMPT (Base Genome)]:
        ${winnerPrompt}

        [LOSER PROMPT (For Contrast)]:
        ${loserPrompt}

        [JUDGE REASONING (Evolutionary Pressure)]:
        ${judgeReasoning}

        [FAILED TEST CASES (Environmental Failures)]:
        ${(failedCases || []).join('\n---\n')}

        [TRAJECTORY HISTORY]:
        ${historyContext}
        `;

        try {
            const response = await callGemini({
                prompt,
                systemInstruction: "You are an Evolutionary Prompt Biologist.",
                jsonMode: true,
                temperature: 0.7
            });

            // Parse using the new Unity Evolution Schema
            const UnitySchema = z.object({
                master_mutation: z.object({
                    logic: z.string(),
                    mutation: z.string()
                })
            });

            // Use robust safeJsonParse instead of manual match
            return safeJsonParse(response, UnitySchema) as EvolutionResult;

        } catch (error) {
            console.error("Optimization Error:", error);
            // Fallback: Return the winner prompt as is if evolution fails
            return {
                master_mutation: {
                    logic: "Evolution failed. Returning winner unchanged.",
                    mutation: winnerPrompt
                }
            };
        }
    }
};
