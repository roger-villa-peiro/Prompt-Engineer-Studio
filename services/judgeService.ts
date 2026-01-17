import { callGroq } from "./groqService";
import { BattleResultSchema, safeJsonParse, callGemini } from "./geminiService";
import { BattleResult } from "../types";

export interface JudgeVerdict {
    winner: 'A' | 'B' | 'Tie';
    reasoning: string;
    scoreA: number;
    scoreB: number;
    judgeName?: string; // Track which model actually judged
}

interface JudgeCandidate {
    id: string;
    name: string;
    provider: 'groq' | 'google';
}

const JURY_POOLS = {
    // Phase 1 Judge: Gemini 2.5 Pro (Only)
    PRIMARY: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' }
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

    const result = safeJsonParse<JudgeVerdict>(responseText, BattleResultSchema);
    // Inject judge name for transparency
    return { ...result, judgeName: judge.name };
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
export async function evaluateBattlePair(promptA: string, promptB: string, context: string): Promise<BattleResult> {

    // Run both jury pools in parallel for this single comparison
    const verdicts = await Promise.all([
        evaluateWithResilientJudge(JURY_POOLS.PRIMARY, promptA, promptB, context),
        evaluateWithResilientJudge(JURY_POOLS.SECONDARY, promptA, promptB, context)
    ]);

    // Simple Average of the two jury members
    const avgScoreA = Math.round((verdicts[0].scoreA + verdicts[1].scoreA) / 2);
    const avgScoreB = Math.round((verdicts[0].scoreB + verdicts[1].scoreB) / 2);

    // Determine consensus winner
    let winner: 'A' | 'B' | 'Tie' = 'Tie';
    if (avgScoreA > avgScoreB + 2) winner = 'A';
    else if (avgScoreB > avgScoreA + 2) winner = 'B';

    // Combine reasoning
    const reasoning = verdicts.map(v => `[${v.judgeName}]: ${v.reasoning}`).join('\n\n');

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
