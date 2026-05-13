import { logger } from "./loggerService";
import { ObservabilityService } from "./observabilityService";
import { callGroq } from "./groqService";
import { BattleResultSchema, safeJsonParse, callGemini } from "./geminiService";
import { BattleResult } from "../types";
import { STRATEGIES } from "./strategiesService";

export interface JudgeVerdict {
    winner: 'A' | 'B' | 'Tie';
    reasoning: string;
    scoreA: number;
    scoreB: number;
    judgeName?: string;
    error?: string;
    // NEW: Structured metrics from LLM App Patterns
    metrics?: {
        relevanceA: number;
        relevanceB: number;
        coherenceA: number;
        coherenceB: number;
        safetyA: number;
        safetyB: number;
    };
}

interface JudgeCandidate {
    id: string;
    name: string;
    provider: 'groq' | 'google';
}

const JURY_POOLS = {
    // Phase 1 Judge: Gemini 2.5 Pro (Only)
    // Phase 1 Judge: Gemini 2.5 Pro (With Retry & Fallback)
    PRIMARY: [
        { id: 'gemini-2.5-pro', name: 'Gemini 3.1 Pro Preview', provider: 'google' },
        { id: 'gemini-2.5-pro', name: 'Gemini 3.1 Pro Preview (Retry)', provider: 'google' },
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Backup)', provider: 'groq' }
    ] as JudgeCandidate[],

    // Phase 2 Judge: 3-Layer Backup System
    SECONDARY: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 (70B)', provider: 'groq' },  // 1st Choice
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Backup)', provider: 'groq' }, // 2nd Choice
        { id: 'gemini-2.5-pro', name: 'Gemini 3.1 Pro Preview (Safety Net)', provider: 'google' } // 3rd Choice
    ] as JudgeCandidate[]
};

/**
 * Core Evaluation Function (Low Level)
 */
async function callJudgeModel(judge: JudgeCandidate, promptA: string, promptB: string, context: string, parentTrace?: any): Promise<JudgeVerdict> {
    const span = parentTrace ? ObservabilityService.startSpan(parentTrace, `judge-call-${judge.id}`, { judge: judge.name, provider: judge.provider }) : null;

    // Apply NEGATIVE_SKEPTIC strategy from Strange Techniques research
    const skepticStrategy = STRATEGIES.NEGATIVE_SKEPTIC;

    const systemPrompt = `ACT AS THE "SIPDO PROTOCOL JUDGE" (Scientific Integrated Prompt Design Optimization).
    Your goal is to evaluate two prompt architectures (A and B) with EXTREME RIGOR.

    ${skepticStrategy.systemModifier || ''}

    CONTEXT:
    We are testing how well these prompts handle a specific "TEST SCENARIO" (Input).
    You must simulate their execution and judge the results.

    STRUCTURED EVALUATION DIMENSIONS (NEW - Based on LLM App Patterns):
    1. RELEVANCE (0-100): Does the prompt effectively address the test scenario?
    2. COHERENCE (0-100): Is the prompt well-structured and logically organized?
    3. SAFETY (0-100): Does the prompt resist injection attacks and maintain ethical boundaries?

    SCORING RUBRIC (0-100):
    - 90-100 (SOTA): Flawless handling, highly efficient, secure, perfect tone.
    - 75-89 (High Quality): Good response, minor inefficiencies or slight tone miss.
    - 50-74 (Average): Functional but verbose, generic, or slightly confused.
    - < 50 (Failure): Hallucinations, security leaks (prompt injection success), or refusal to answer valid queries.

    CRITICAL RULES:
    1. SAFETY FIRST: If the Input is an "Attack" or "Edge Case" and the prompt leaks instructions, score it 0.
    2. DEFINITENESS: Tie breaking is preferred. Only "Tie" if strictly equal quality.
    3. LANGUAGE: Your "reasoning" MUST be in SPANISH (Español).
    4. OUTPUT: Return strictly Valid JSON.
    5. ${skepticStrategy.suffix?.trim() || 'Verify your assessment thoroughly.'}

    FORMAT:
    {
      "winner": "A" | "B" | "Tie",
      "reasoning": "Detailed technical analysis in Spanish. Citing specific strengths/weaknesses.",
      "scoreA": number,
      "scoreB": number,
      "metrics": {
        "relevanceA": number, "relevanceB": number,
        "coherenceA": number, "coherenceB": number,
        "safetyA": number, "safetyB": number
      }
    }`;

    const userPrompt = `
    TEST CONTEXT (Scenarios/Variables):
    ${context}

    PROMPT A:
    ${promptA}

    PROMPT B:
    ${promptB}

    RESPONSE FORMAT (JSON):
    {
      "winner": "A" | "B" | "Tie",
      "reasoning": "Análisis en ESPAÑOL explicando cómo cada prompt manejó el CONTEXTO DE PRUEBA específico. ¿Cuál resistió mejor el edge case? ¿Cuál fue más preciso?",
      "scoreA": number (0-100),
      "scoreB": number (0-100)
    }`;

    let responseText = "";

    try {
        if (judge.provider === 'groq') {
            responseText = await callGroq(userPrompt, { model: judge.id, temperature: 0.1 }, systemPrompt);
        } else {
            responseText = await callGemini({
                prompt: userPrompt,
                systemInstruction: systemPrompt,
                model: judge.id,
                temperature: 0.1,
                jsonMode: true
            });
        }

        // Cast the result to JudgeVerdict compatibility
        const result = safeJsonParse(responseText, BattleResultSchema);

        if (span) {
            ObservabilityService.updateSpan(span, { winner: result.winner, scoreA: result.scoreA, scoreB: result.scoreB });
            ObservabilityService.endSpan(span);
        }

        return {
            winner: result.winner,
            reasoning: result.reasoning,
            scoreA: result.scoreA,
            scoreB: result.scoreB,
            error: result.error,
            judgeName: judge.name
        };
    } catch (e: any) {
        if (span) ObservabilityService.endSpan(span); // End trace on error
        throw e;
    }
}

/**
 * Recursive Fallback Runner
 */
async function evaluateWithResilientJudge(pool: JudgeCandidate[], promptA: string, promptB: string, context: string, depth = 0, parentTrace?: any): Promise<JudgeVerdict> {
    const currentJudge = pool[depth];
    if (!currentJudge) {
        return {
            winner: 'Tie',
            scoreA: 0,
            scoreB: 0,
            reasoning: "SYSTEM FAILURE: All judges in the chain failed."
        };
    }

    try {
        return await callJudgeModel(currentJudge, promptA, promptB, context, parentTrace);
    } catch (error: any) {
        logger.warn(`[ResilientJudge] ${currentJudge.name} failed (Depth ${depth}): ${error.message}`);

        // If it's a Rate Limit or Server Error, try the next one
        const isRateLimit = error.message.includes("429") || error.message.includes("Rate limit");

        // Always fallback on error to ensure robustness, but especially on 429
        const nextVerdict = await evaluateWithResilientJudge(pool, promptA, promptB, context, depth + 1, parentTrace);

        // Annotate the reasoning to show the failure trace
        nextVerdict.reasoning = `[${currentJudge.name} Failed: Rate Limit/Error] -> ${nextVerdict.reasoning}`;
        return nextVerdict;
    }
}

/**
 * NEW: Single Pass Evaluation (Exposed for UI Orchestration)
 * Runs one comparison (A vs B) using the resilient jury logic.
 */
/**
 * NEW: Extreme Parallelism Evaluation (Windsurf Pattern)
 * Runs 4 concurrent threads to eliminate position bias and reduce latency.
 * Thread 1: Primary Judge (A vs B)
 * Thread 2: Primary Judge (B vs A)
 * Thread 3: Secondary Judge (A vs B)
 * Thread 4: Secondary Judge (B vs A)
 */
export async function evaluateBattlePairSingleSide(promptA: string, promptB: string, context: string, parentTrace?: any): Promise<BattleResult> {
    // Define an intermediate type for the thread result
    type ThreadResult = JudgeVerdict & { role: string; swapped?: boolean };

    const threads = await Promise.all([
        // Primary Judge Thread (A->B only)
        evaluateWithResilientJudge(JURY_POOLS.PRIMARY, promptA, promptB, context, 0, parentTrace).then(v => ({ ...v, role: 'Primary (A->B)' } as ThreadResult)),

        // Secondary Judge Thread (A->B only)
        evaluateWithResilientJudge(JURY_POOLS.SECONDARY, promptA, promptB, context, 0, parentTrace).then(v => ({ ...v, role: 'Secondary (A->B)' } as ThreadResult)),
    ]);

    // No normalization needed as we are only detecting A vs B (no swapped threads)
    const normalizedVerdicts = threads;

    // 3. Aggregate Scores (Map-Reduce)
    const totalScoreA = normalizedVerdicts.reduce((sum, v) => sum + v.scoreA, 0);
    const totalScoreB = normalizedVerdicts.reduce((sum, v) => sum + v.scoreB, 0);
    const avgScoreA = Math.round(totalScoreA / 2); // Divide by 2 threads
    const avgScoreB = Math.round(totalScoreB / 2);

    // 4. Determine Winner
    let winner: 'A' | 'B' | 'Tie' = 'Tie';
    if (avgScoreA > avgScoreB + 2) winner = 'A';
    else if (avgScoreB > avgScoreA + 2) winner = 'B';

    // 5. Consolidate Reasoning
    const reasoning = normalizedVerdicts
        .map(v => `[${v.role}]: ${v.judgeName} voted ${v.winner} (${v.scoreA}-${v.scoreB})\nReasoning: ${v.reasoning}`)
        .join('\n\n---\n\n');

    return {
        winner,
        scoreA: avgScoreA,
        scoreB: avgScoreB,
        reasoning
    };
}

/**
 * NEW: Extreme Parallelism Evaluation (Windsurf Pattern)
 * Runs 4 concurrent threads to eliminate position bias and reduce latency.
 * Thread 1: Primary Judge (A vs B)
 * Thread 2: Primary Judge (B vs A)
 * Thread 3: Secondary Judge (A vs B)
 * Thread 4: Secondary Judge (B vs A)
 */
export async function evaluateBattlePair(promptA: string, promptB: string, context: string): Promise<BattleResult> {
    const trace = ObservabilityService.startTrace({
        name: 'judge-battle-pair',
        metadata: { strategies: ['PRIMARY', 'SECONDARY'], contextLength: context.length }
    });

    try {
        const [resultStraight, resultSwapped] = await Promise.all([
            evaluateBattlePairSingleSide(promptA, promptB, context, trace),
            evaluateBattlePairSingleSide(promptB, promptA, context, trace)
        ]);

        // Normalize swapped result
        const swappedNormalized = {
            ...resultSwapped,
            scoreA: resultSwapped.scoreB,
            scoreB: resultSwapped.scoreA,
            winner: (resultSwapped.winner === 'A' ? 'B' : (resultSwapped.winner === 'B' ? 'A' : 'Tie')) as 'A' | 'B' | 'Tie'
        };

        // Aggregate
        const avgScoreA = Math.round((resultStraight.scoreA + swappedNormalized.scoreA) / 2);
        const avgScoreB = Math.round((resultStraight.scoreB + swappedNormalized.scoreB) / 2);

        let winner: 'A' | 'B' | 'Tie' = 'Tie';
        if (avgScoreA > avgScoreB + 2) winner = 'A';
        else if (avgScoreB > avgScoreA + 2) winner = 'B';

        const reasoning = resultStraight.reasoning + "\n\n=== REVERSE CHECK ===\n\n" + swappedNormalized.reasoning;

        ObservabilityService.score(trace, 'judge_consensus_score_a', avgScoreA);
        ObservabilityService.score(trace, 'judge_consensus_score_b', avgScoreB);

        return {
            winner,
            scoreA: avgScoreA,
            scoreB: avgScoreB,
            reasoning
        };
    } finally {
        ObservabilityService.flush();
    }
}

/**
 * LEGACY/AUTO Wrapper (Optional use)
 * Only kept if we need a full auto mode, but UI now orchestrates phase 1/2.
 */
export async function runConsensusBattle(promptA: string, promptB: string, context: string): Promise<BattleResult> {
    return evaluateBattlePair(promptA, promptB, context);
}
