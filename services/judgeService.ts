import { callGroq } from "./groqService";
import { BattleResultSchema, safeJsonParse } from "./geminiService";
import { BattleResult } from "../types";

interface JudgeVerdict {
    winner: 'A' | 'B' | 'Tie';
    reasoning: string;
    scoreA: number;
    scoreB: number;
}

async function evaluateWithJudge(judgeModel: string, judgeName: string, promptA: string, promptB: string, context: string): Promise<JudgeVerdict> {
    const systemPrompt = `You are ${judgeName}, an expert AI Prompt Engineer and Judge. 
    Compare the following two prompts (Architecture A and Architecture B) designed for an LLM. 
    Evaluate them based on clarity, robustness (prevention of leaks/jailbreaks), and adherence to prompt engineering best practices (like chain-of-thought, clear constraints, etc).
    
    CRITICALLY IMPORTANT: Return ONLY valid JSON in the specified format. The 'reasoning' field MUST BE IN SPANISH.`;

    const userPrompt = `PROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}\n\nTEST CONTEXT (Variables):\n${context}\n\nRESPONSE FORMAT (JSON):\n{\n  "winner": "A" | "B" | "Tie",\n  "reasoning": "Análisis técnico detallado y profundo explicando el ganador (EN ESPAÑOL).",\n  "scoreA": number (0-100),\n  "scoreB": number (0-100)\n}`;

    const response = await callGroq(userPrompt, { model: judgeModel, temperature: 0.1 }, systemPrompt);
    return safeJsonParse(response, BattleResultSchema);
}

export async function runConsensusBattle(promptA: string, promptB: string, context: string): Promise<BattleResult> {

    // Define our Jury
    const jury = [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3' },
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' }
    ];

    try {
        // Run evaluations in parallel
        const results = await Promise.all(jury.map(judge =>
            evaluateWithJudge(judge.id, judge.name, promptA, promptB, context)
                .catch(err => ({
                    winner: 'Tie' as const,
                    reasoning: `(Judge ${judge.name} failed: ${err.message})`,
                    scoreA: 0,
                    scoreB: 0
                }))
        ));

        // Aggregate Scores
        const avgScoreA = Math.round(results.reduce((acc, r) => acc + r.scoreA, 0) / results.length);
        const avgScoreB = Math.round(results.reduce((acc, r) => acc + r.scoreB, 0) / results.length);

        // Determine Winner
        let winner: 'A' | 'B' | 'Tie' = 'Tie';
        if (avgScoreA > avgScoreB + 2) winner = 'A'; // Tiny threshold to avoid flip-flopping
        else if (avgScoreB > avgScoreA + 2) winner = 'B';

        // Synthesize Reasoning
        const consensusReasoning = results.map((r, i) => `[${jury[i].name}]: ${r.reasoning}`).join('\n\n');

        return {
            winner,
            scoreA: avgScoreA,
            scoreB: avgScoreB,
            reasoning: consensusReasoning
        };

    } catch (error: any) {
        console.error("Consensus Battle Failed:", error);
        return {
            winner: 'Tie',
            scoreA: 0,
            scoreB: 0,
            reasoning: `Audit System Failure: ${error.message}`,
            error: error.message
        };
    }
}
