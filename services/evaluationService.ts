import { callGemini, safeJsonParse } from "./geminiService";
import { z } from "zod";

export interface EvaluationCriteria {
    coherence: number;
    faithfulness: number;
    toxicity: boolean;
    jsonValid: boolean;
    reasoning: string;
}

export interface EvaluationResult {
    score: number; // 0-100
    criteria: EvaluationCriteria;
    latencyMs: number;
    tokenCount: number;
    costEstimate: number; // In micro-dollars
}

const EvaluationSchema = z.object({
    coherence: z.number().min(1).max(10),
    faithfulness: z.number().min(1).max(10),
    toxicity: z.boolean(),
    json_validity: z.boolean(),
    reasoning: z.string(),
});

/**
 * EVALUATION SERVICE
 * Uses "LLM-as-a-Judge" pattern to score prompt outputs.
 */
export const EvaluationService = {

    async evaluateOutput(
        input: string,
        output: string,
        expectedContext: string = ""
    ): Promise<EvaluationResult> {
        const startTime = performance.now();

        // 1. LLM Judge Evaluation
        const prompt = `
      ACT AS AN EXTREMELY STRICT AI JUDGE. Your job is to critically evaluate the output.
      
      INPUT PROMPT:
      ${input}
      
      ACTUAL OUTPUT:
      ${output}
      
      EXPECTED CONTEXT/GOAL:
      ${expectedContext || "No specific context provided. Evaluate based on general helpfulness, accuracy, and depth."}
      
      CRITERIA TO GRADE (Be harsh, do not give 10/10 unless perfect):
      - Coherence (1-10): Is the text logical and fluid?
      - Faithfulness (1-10): Did it follow instructions precisely?
      - Toxicity (true/false): Is it harmful?
      - Json Validity (true/false): If JSON was requested, is it valid? (default true if not requested)
      
      IMPORTANT: 
      - If the output says "I cannot answer" or is evasive, Faithfulness must be low (<5).
      - If the output is generic, Coherence might be high but Faithfulness should be moderate.
      - Return REALISTIC scores. 10/10 is reserved for God-tier outputs.
      
      RESPONSE FORMAT:
      You MUST provide a "Thinking Process" block first, then the JSON.
      
      Thinking Process:
      [ Analyze step-by-step in Spanish. Cite specific evidence from the ACTUAL OUTPUT that justifies your score. ]
      
      {
        "coherence": number,
        "faithfulness": number,
        "toxicity": boolean,
        "json_validity": boolean,
        "reasoning": "Summary of the thinking process (EN ESPAÑOL)"
      }
    `;

        let criteria: EvaluationCriteria;
        try {
            const response = await callGemini({
                prompt,
                jsonMode: true,
                temperature: 0.1 // Deterministic for judging
            });



            // Use robust parser to handle "Thinking Process" blocks
            const parsed = safeJsonParse(response, EvaluationSchema);
            const validated = parsed; // safeJsonParse already validates with simple any, but here we passed schema so it is T

            criteria = {
                coherence: validated.coherence,
                faithfulness: validated.faithfulness,
                toxicity: validated.toxicity,
                jsonValid: validated.json_validity,
                reasoning: validated.reasoning
            };

        } catch (e) {
            console.error("Evaluation failed", e);
            // Fallback for failure
            criteria = {
                coherence: 0,
                faithfulness: 0,
                toxicity: false,
                jsonValid: false,
                reasoning: "Evaluation Failed: " + (e as Error).message
            };
        }

        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        // 2. Metrics Calculation
        // Estimate tokens (approx 4 chars per token)
        const inputTokens = input.length / 4;
        const outputTokens = output.length / 4;
        const totalTokens = Math.round(inputTokens + outputTokens);

        // Cost estimate (Gemini Pro pricing approx: $0.50 / 1M input, $1.50 / 1M output)
        // Simplified: $1.00 per 1M tokens average -> $0.000001 per token
        const cost = totalTokens * 0.000001;

        // Aggregate Score (Weighted)
        const score = Math.round(
            (criteria.coherence * 4) + // 40%
            (criteria.faithfulness * 6) // 60%
        );

        return {
            score,
            criteria,
            latencyMs: latency,
            tokenCount: totalTokens,
            costEstimate: cost
        };
    }
};
