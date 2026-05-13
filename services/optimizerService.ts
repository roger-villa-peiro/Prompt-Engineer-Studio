import { logger } from "./loggerService";
import { callGemini, safeJsonParse } from "./geminiService";
import { EVOLUTIONARY_BIOLOGIST_PROMPT } from "../config/systemPrompts";
import { z } from "zod";
import { applyStrategy, StrategyType } from "./strategiesService";

interface EvolutionParams {
    winnerPrompt: string;
    loserPrompt: string;
    judgeReasoning: string;
    failedCases?: string[];
    history?: { version: string, message?: string }[];
    strategy?: StrategyType; // NEW: Apply a prompting strategy
}

export interface EvolutionResult {
    status?: 'EVOLVING' | 'CONVERGED';
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

import { generateStressTests, evaluateAgainstTests, patchPromptFromFailures } from "./sipdoService";

// ... existing imports

export const OptimizerService = {
    /**
     * Evolves a winning prompt into a superior version using Judge's feedback.
     */
    async evolvePrompt(params: EvolutionParams): Promise<EvolutionResult> {
        const { winnerPrompt, loserPrompt, judgeReasoning, failedCases = [], history = [], strategy } = params;

        // ... existing prompt logic ...
        // Apply strategy if specified
        const appliedStrategy = strategy ? applyStrategy('', strategy) : null;
        const strategyGuidance = appliedStrategy && appliedStrategy.strategyName !== 'Ninguna'
            ? `\n\n[PROMPTING STRATEGY TO EMBED]: ${appliedStrategy.strategyName}\nGuidance: The evolved prompt should incorporate elements of this style: ${appliedStrategy.modifiedSystemInstruction || 'N/A'}`
            : '';

        const historyContext = history.map(h => `[Version ${h.version}]: ${h.message || 'No description'}`).join('\n');

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
        ${strategyGuidance}
        
        [INSTRUCTION]:
        Evolve the prompt based on the reasoning and strategy.
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
                status: z.enum(['EVOLVING', 'CONVERGED']).optional().default('EVOLVING'),
                master_mutation: z.object({
                    logic: z.string(),
                    mutation: z.string()
                })
            });

            // Use robust safeJsonParse instead of manual match
            const result = safeJsonParse(response, UnitySchema) as EvolutionResult;

            // --- SIPDO Integration (Stress-Test the Mutation) ---
            if (result.master_mutation && result.master_mutation.mutation) {
                const candidate = result.master_mutation.mutation;

                // 1. Generate Stress Tests
                const stressTests = await generateStressTests(candidate, 3);

                if (stressTests.length > 0) {
                    // 2. Evaluate
                    const stressResult = await evaluateAgainstTests(candidate, stressTests);

                    // 3. Patch if needed
                    if (!stressResult.passed && stressResult.failures.length > 0) {
                        const patchedPrompt = await patchPromptFromFailures(candidate, stressResult.failures);

                        // Update result with patched version
                        result.master_mutation.mutation = patchedPrompt;
                        result.master_mutation.logic += `\n[SIPDO]: Stress-tested against ${stressTests.length} cases. Patched ${stressResult.failures.length} failures.`;
                    } else {
                        result.master_mutation.logic += `\n[SIPDO]: Passed ${stressTests.length} stress tests perfectly.`;
                    }
                }
            }

            return result;

        } catch (error) {
            logger.error("Optimization Error:", error);
            // Fallback: Return the winner prompt as is if evolution fails
            return {
                status: 'CONVERGED',
                master_mutation: {
                    logic: "Evolution failed or timed out. Keeping original.",
                    mutation: winnerPrompt
                }
            };
        }
    }
};
