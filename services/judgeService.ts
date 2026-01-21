import { callGroq } from "./groqService";
import { BattleResultSchema, safeJsonParse, callGemini } from "./geminiService";
import { BattleResult } from "../types";

export interface JudgeVerdict {
    winner: 'A' | 'B' | 'Tie';
    reasoning: string;
    scoreA: number;
    scoreB: number;
    judgeName?: string; // Track which model actually judged
    error?: string; // Added optional error field to match BattleResultSchema if needed or for internal logic
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
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Retry)', provider: 'google' },
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Backup)', provider: 'groq' }
    ] as JudgeCandidate[],

    // Phase 2 Judge: 3-Layer Backup System
    SECONDARY: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 (70B)', provider: 'groq' },  // 1st Choice
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Backup)', provider: 'groq' }, // 2nd Choice
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Safety Net)', provider: 'google' } // 3rd Choice
    ] as JudgeCandidate[]
};

/**
 * Core Evaluation Function (Low Level)
 */
async function callJudgeModel(judge: JudgeCandidate, promptA: string, promptB: string, context: string): Promise<JudgeVerdict> {
    const systemPrompt = `You are ${judge.name}, an expert AI Prompt Engineer and Judge. 
    Compare the following two prompts (Architecture A and Architecture B) designed for an LLM. 
    Evaluate them based on clarity, robustness (prevention of leaks/jailbreaks), and adherence to prompt engineering best practices (like chain-of-thought, clear constraints, etc).
    
    CRITICALLY IMPORTANT: Return ONLY valid JSON in the specified format. The 'reasoning' field MUST BE IN SPANISH.`;

    const userPrompt = `PROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}\n\nTEST CONTEXT (Variables):\n${context}\n\nRESPONSE FORMAT (JSON):\n{\n  "winner": "A" | "B" | "Tie",\n  "reasoning": "Análisis técnico detallado y profundo explicando el ganador (EN ESPAÑOL).",\n  "scoreA": number (0-100),\n  "scoreB": number (0-100)\n}`;

    let responseText = "";

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

    return {
        winner: result.winner,
        reasoning: result.reasoning,
        scoreA: result.scoreA,
        scoreB: result.scoreB,
        error: result.error,
        judgeName: judge.name
    };
}

/**
 * Recursive Fallback Runner
 */
async function evaluateWithResilientJudge(pool: JudgeCandidate[], promptA: string, promptB: string, context: string, depth = 0): Promise<JudgeVerdict> {
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
        return await callJudgeModel(currentJudge, promptA, promptB, context);
    } catch (error: any) {
        console.warn(`[ResilientJudge] ${currentJudge.name} failed (Depth ${depth}): ${error.message}`);

        // If it's a Rate Limit or Server Error, try the next one
        const isRateLimit = error.message.includes("429") || error.message.includes("Rate limit");

        // Always fallback on error to ensure robustness, but especially on 429
        const nextVerdict = await evaluateWithResilientJudge(pool, promptA, promptB, context, depth + 1);

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
export async function evaluateBattlePair(promptA: string, promptB: string, context: string): Promise<BattleResult> {

    // 1. Launch all 4 threads simultaneously

    // Define an intermediate type for the thread result that includes the mandatory 'role' and optional 'swapped'
    type ThreadResult = JudgeVerdict & { role: string; swapped?: boolean };

    const threads = await Promise.all([
        // Primary Judge Threads
        evaluateWithResilientJudge(JURY_POOLS.PRIMARY, promptA, promptB, context).then(v => ({ ...v, role: 'Primary (A->B)' } as ThreadResult)),
        evaluateWithResilientJudge(JURY_POOLS.PRIMARY, promptB, promptA, context).then(v => ({ ...v, role: 'Primary (B->A)', swapped: true } as ThreadResult)),

        // Secondary Judge Threads
        evaluateWithResilientJudge(JURY_POOLS.SECONDARY, promptA, promptB, context).then(v => ({ ...v, role: 'Secondary (A->B)' } as ThreadResult)),
        evaluateWithResilientJudge(JURY_POOLS.SECONDARY, promptB, promptA, context).then(v => ({ ...v, role: 'Secondary (B->A)', swapped: true } as ThreadResult))
    ]);

    // 2. Normalize Results (Flip scores for swapped threads)
    const normalizedVerdicts = threads.map(t => {
        if (t.swapped) {
            return {
                ...t,
                // If B vs A, then scoreA is actually B's score
                scoreA: t.scoreB,
                scoreB: t.scoreA,
                // Flip winner
                winner: (t.winner === 'A' ? 'B' : (t.winner === 'B' ? 'A' : 'Tie')) as 'A' | 'B' | 'Tie'
            };
        }
        return t;
    });

    // 3. Aggregate Scores (Map-Reduce)
    const totalScoreA = normalizedVerdicts.reduce((sum, v) => sum + v.scoreA, 0);
    const totalScoreB = normalizedVerdicts.reduce((sum, v) => sum + v.scoreB, 0);
    const avgScoreA = Math.round(totalScoreA / 4);
    const avgScoreB = Math.round(totalScoreB / 4);

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
 * LEGACY/AUTO Wrapper (Optional use)
 * Only kept if we need a full auto mode, but UI now orchestrates phase 1/2.
 */
export async function runConsensusBattle(promptA: string, promptB: string, context: string): Promise<BattleResult> {
    return evaluateBattlePair(promptA, promptB, context);
}
