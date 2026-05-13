import { logger } from "./loggerService";
import { callGemini, safeJsonParse } from "./geminiService";
import { z } from "zod";

export interface EvaluationCriteria {
    coherence: number;
    faithfulness: number;
    toxicity: boolean;
    jsonValid: boolean;
    reasoning: string;
    // RAG Triad — new in Phase 2
    contextRelevance: number;   // ¿El contexto recuperado es relevante? (1-10)
    groundedness: number;       // ¿La respuesta se basa SOLO en el contexto? (1-10)
    answerRelevance: number;    // ¿Responde la pregunta original? (1-10)
}

export interface EvaluationResult {
    score: number; // 0-100
    criteria: EvaluationCriteria;
    ragTriadScore: number; // 0-100, average of triad metrics
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
    context_relevance: z.number().min(1).max(10).optional().default(5),
    groundedness: z.number().min(1).max(10).optional().default(5),
    answer_relevance: z.number().min(1).max(10).optional().default(5),
});

/**
 * EVALUATION SERVICE
 * Uses "LLM-as-a-Judge" pattern to score prompt outputs.
 * Extended with RAG Triad metrics (Phase 2).
 */
export const EvaluationService = {

    async evaluateOutput(
        input: string,
        output: string,
        expectedContext: string = ""
    ): Promise<EvaluationResult> {
        const startTime = performance.now();

        const hasContext = expectedContext.length > 50;

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
      
      RAG TRIAD METRICS (New — evaluate carefully):
      - Context Relevance (1-10): Is the provided context/goal relevant to answering the input? ${!hasContext ? '(Default to 5 if no context was given)' : ''}
      - Groundedness (1-10): Does the output stick to verifiable facts from the context? Or does it hallucinate/invent information? 10 = fully grounded, 1 = pure fabrication.
      - Answer Relevance (1-10): Does the output actually answer the user's question/intent? A well-written but off-topic response should score low.
      
      IMPORTANT: 
      - If the output says "I cannot answer" or is evasive, Faithfulness must be low (<5).
      - If the output is generic, Coherence might be high but Faithfulness should be moderate.
      - Return REALISTIC scores. 10/10 is reserved for God-tier outputs.
      - Groundedness: If the output contains specific numbers, dates, or claims not in the context, score LOW.
      - Answer Relevance: Does the output DIRECTLY solve what was asked? Tangential answers = low score.
      
      RESPONSE FORMAT:
      You MUST provide a "Thinking Process" block first, then the JSON.
      
      Thinking Process:
      [ Analyze step-by-step in Spanish. Cite specific evidence from the ACTUAL OUTPUT that justifies your score. ]
      
      {
        "coherence": number,
        "faithfulness": number,
        "toxicity": boolean,
        "json_validity": boolean,
        "context_relevance": number,
        "groundedness": number,
        "answer_relevance": number,
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

            criteria = {
                coherence: parsed.coherence,
                faithfulness: parsed.faithfulness,
                toxicity: parsed.toxicity,
                jsonValid: parsed.json_validity,
                reasoning: parsed.reasoning,
                contextRelevance: parsed.context_relevance,
                groundedness: parsed.groundedness,
                answerRelevance: parsed.answer_relevance,
            };

        } catch (e) {
            logger.error("Evaluation failed", e);
            // Fallback for failure
            criteria = {
                coherence: 0,
                faithfulness: 0,
                toxicity: false,
                jsonValid: false,
                reasoning: "Evaluation Failed: " + (e as Error).message,
                contextRelevance: 0,
                groundedness: 0,
                answerRelevance: 0,
            };
        }

        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        // 2. Metrics Calculation
        const inputTokens = input.length / 4;
        const outputTokens = output.length / 4;
        const totalTokens = Math.round(inputTokens + outputTokens);

        // Cost estimate (Gemini Pro pricing approx)
        const cost = totalTokens * 0.000001;

        // Classic score (backward-compatible)
        const classicScore = Math.round(
            (criteria.coherence * 4) + // 40%
            (criteria.faithfulness * 6) // 60%
        );

        // RAG Triad Score (average of 3 metrics, normalized to 0-100)
        const ragTriadScore = Math.round(
            ((criteria.contextRelevance + criteria.groundedness + criteria.answerRelevance) / 3) * 10
        );

        return {
            score: classicScore,
            criteria,
            ragTriadScore,
            latencyMs: latency,
            tokenCount: totalTokens,
            costEstimate: cost
        };
    }
};
