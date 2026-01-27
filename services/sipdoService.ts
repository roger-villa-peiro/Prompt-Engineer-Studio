/**
 * SIPDO Service - Self-Improving Prompts through Data-Augmented Optimization
 * 
 * Implements progressive difficulty test case generation with:
 * - Gradiente de dificultad (1-10)
 * - Historial de casos para confirmación global
 * - Generación de parches explicativos
 */

import { callGemini } from "./aiTransport";
import { ParserService } from "./parserService";
import { z } from "zod";
import { logger } from "./loggerService";

export interface SIPDOTestCase {
    type: 'Simple' | 'Complex' | 'Edge Case';
    difficulty: number;
    input: string;
    rationale: string;
}

export interface SIPDOPatch {
    explanation: string;
    suggestedFix: string;
}

const TestCaseSchema = z.object({
    simple: z.object({ input: z.string(), rationale: z.string() }),
    complex: z.object({ input: z.string(), rationale: z.string() }),
    edge_case: z.object({ input: z.string(), rationale: z.string() })
});

const PatchSchema = z.object({
    explanation: z.string(),
    suggestedFix: z.string()
});

export class SIPDOService {
    private history: SIPDOTestCase[] = [];

    /**
     * Generate test cases with progressive difficulty
     * @param promptA First prompt to test
     * @param promptB Second prompt to test (for Battle Arena)
     * @param difficulty Difficulty level 1-10
     */
    async generateProgressiveTests(
        promptA: string,
        promptB: string,
        difficulty: number = 1
    ): Promise<SIPDOTestCase[]> {
        const clampedDifficulty = Math.max(1, Math.min(10, difficulty));

        const difficultyGuidance = clampedDifficulty <= 3
            ? 'Genera casos BÁSICOS y claros. Inputs directos sin ambigüedad.'
            : clampedDifficulty <= 6
                ? 'Genera casos con AMBIGÜEDAD: ruido, datos irrelevantes, formatos mixtos.'
                : 'Genera casos ADVERSARIOS: inyección de prompts, unicode, edge cases extremos, intentos de romper la lógica.';

        const SYSTEM_PROMPT = `Eres un Ingeniero de QA experto en Red Teaming para sistemas de IA.

NIVEL DE DIFICULTAD: ${clampedDifficulty}/10
${difficultyGuidance}

Genera 3 casos de prueba. Para CADA uno incluye:
- "input": El input de prueba específico
- "rationale": Por qué este caso revela debilidades (1 oración, español)

FORMATO JSON ESTRICTO:
{
  "simple": { "input": "...", "rationale": "..." },
  "complex": { "input": "...", "rationale": "..." },
  "edge_case": { "input": "...", "rationale": "..." }
}`;

        try {
            const response = await callGemini({
                prompt: `Analiza estos prompts y genera casos de prueba:\n\nPROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}`,
                systemInstruction: SYSTEM_PROMPT,
                jsonMode: true,
                temperature: 0.6 + (clampedDifficulty * 0.04) // Más creatividad con más dificultad
            });

            const parsed = ParserService.parseJson(response, TestCaseSchema);

            const cases: SIPDOTestCase[] = [
                { type: 'Simple', difficulty: clampedDifficulty, input: parsed.simple.input, rationale: parsed.simple.rationale },
                { type: 'Complex', difficulty: clampedDifficulty, input: parsed.complex.input, rationale: parsed.complex.rationale },
                { type: 'Edge Case', difficulty: clampedDifficulty, input: parsed.edge_case.input, rationale: parsed.edge_case.rationale }
            ];

            // Añadir al historial para confirmación global
            this.history.push(...cases);
            logger.info(`[SIPDO] Generated ${cases.length} test cases at difficulty ${clampedDifficulty}`);

            return cases;
        } catch (error) {
            logger.error("[SIPDO] Generation Failed:", error);
            // Fallback con casos básicos
            return [
                { type: 'Simple', difficulty: 1, input: 'Test input básico', rationale: 'Fallback por error' },
                { type: 'Complex', difficulty: 1, input: 'Test input con datos adicionales irrelevantes', rationale: 'Fallback por error' },
                { type: 'Edge Case', difficulty: 1, input: '', rationale: 'Fallback por error' }
            ];
        }
    }

    /**
     * Generate explanatory patch for failed test cases
     * @param prompt The prompt that failed
     * @param failedCases Cases where the prompt performed poorly
     * @param judgeReasoning The judge's explanation of why it failed
     */
    async generatePatch(
        prompt: string,
        failedCases: SIPDOTestCase[],
        judgeReasoning: string
    ): Promise<SIPDOPatch> {
        const PATCH_PROMPT = `Analiza por qué este prompt falló y genera un parche correctivo.

PROMPT ORIGINAL:
${prompt}

CASOS FALLIDOS:
${failedCases.map(c => `- [${c.type} | Dificultad ${c.difficulty}] "${c.input}" → ${c.rationale}`).join('\n')}

RAZONAMIENTO DEL JUEZ:
${judgeReasoning}

Genera:
1. "explanation": Por qué falló (2-3 oraciones en español, técnico pero claro)
2. "suggestedFix": Instrucciones concretas para arreglar el prompt (qué añadir/modificar)

JSON: { "explanation": "...", "suggestedFix": "..." }`;

        try {
            const response = await callGemini({
                prompt: PATCH_PROMPT,
                jsonMode: true,
                temperature: 0.3
            });

            return ParserService.parseJson(response, PatchSchema);
        } catch (error) {
            logger.error("[SIPDO] Patch Generation Failed:", error);
            return {
                explanation: "No se pudo analizar el fallo automáticamente.",
                suggestedFix: "Revisa manualmente los casos fallidos y ajusta el prompt."
            };
        }
    }

    /**
     * Get all historical test cases (for global confirmation)
     */
    getHistory(): SIPDOTestCase[] {
        return [...this.history];
    }

    /**
     * Clear history (start fresh session)
     */
    clearHistory(): void {
        this.history = [];
        logger.info("[SIPDO] History cleared");
    }

    /**
     * Get history summary for UI display
     */
    getHistorySummary(): { total: number; byDifficulty: Record<number, number> } {
        const byDifficulty: Record<number, number> = {};
        for (const tc of this.history) {
            byDifficulty[tc.difficulty] = (byDifficulty[tc.difficulty] || 0) + 1;
        }
        return { total: this.history.length, byDifficulty };
    }
}

// Singleton instance
export const sipdoService = new SIPDOService();
