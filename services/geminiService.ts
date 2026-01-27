
import { logger } from "./loggerService";
import { z } from "zod"; // Needed if we re-export schemas or use them locally for small utilities
import { AI_CONFIG } from "../config/aiConfig";
import { BattleResult, Attachment, ChatMessage } from "../types";
import { searchKnowledge, formatKnowledgeContext } from "./knowledgeService";

// Import new modular services
import { callGemini } from "./aiTransport";
import { ReliabilityService } from "./reliabilityService";
import { ParserService } from "./parserService";
import { AgentOrchestrator } from "./agentOrchestrator";
import {
  OptimizationResult,
  InterviewerResponse,
  BattleResultSchema,
  ArchitectResponseSchema,
  CriticResponseSchema,
  InterviewerResponseSchema,
  RequirementsResponseSchema,
  DesignResponseSchema,
  TasksResponseSchema
} from "./schemas";

// Re-export types and schemas for backward compatibility
export type { OptimizationResult, ChatMessage, InterviewerResponse, BattleResult };
export {
  ArchitectResponseSchema,
  CriticResponseSchema,
  InterviewerResponseSchema,
  RequirementsResponseSchema,
  DesignResponseSchema,
  TasksResponseSchema,
  BattleResultSchema,
  callGemini
};

/**
 * CORE SERVICE ADAPTER
 * This file now acts as a facade, delegating to specialized services.
 */

export const optimizePrompt = async (
  currentPrompt: string,
  history: ChatMessage[] = [],
  onProgress?: (stage: string, detail: string) => void,
  contextData?: string,
  options?: {
    skipInterviewer?: boolean;
    model?: string;
    signal?: AbortSignal;
    attachments?: Attachment[];
    subType?: 'CODING' | 'PLANNING' | 'WRITING' | 'GENERAL';
    vibeContext?: string;
  }
): Promise<OptimizationResult | InterviewerResponse> => {
  const orchestrator = new AgentOrchestrator();
  onProgress?.('START', 'Iniciando pipeline cognitivo...');

  if (!options?.skipInterviewer && options?.subType !== 'PLANNING') {
    const clarity = await orchestrator.assessInputClarity(currentPrompt, history, contextData || '', options?.attachments, options?.signal, onProgress);
    if (clarity.status === "NEEDS_CLARIFICATION") return clarity;
  }

  // PARALLEL KNOWLEDGE SEARCH
  let knowledgeContext = "";
  if (options?.subType !== 'PLANNING') {
    onProgress?.('SEARCH', 'Buscando contexto fresco en paralelo...');
    const snippets = await searchKnowledge(currentPrompt);
    if (snippets.length > 0) {
      knowledgeContext = formatKnowledgeContext(snippets);
      onProgress?.('SEARCH', `Encontrados ${snippets.length} recursos relevantes.`);
    }
  }

  // DISPATCHER
  if (options?.subType === 'PLANNING') {
    return await orchestrator.runSpecArchitectFlow(currentPrompt, history, onProgress, options?.signal);
  }

  return await orchestrator.optimizePromptFlow(
    currentPrompt,
    history,
    onProgress,
    contextData || '',
    options?.signal,
    options?.attachments || [],
    options?.model,
    options?.subType,
    options?.vibeContext,
    knowledgeContext
  );
}

export async function runPrompt(prompt: string, variables: Record<string, string>, signal?: AbortSignal): Promise<string> {
  let finalPrompt = prompt;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    finalPrompt = finalPrompt.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, "g"), value || "");
  }
  return await callGemini({ prompt: finalPrompt, signal });
}

export async function evaluateResponse(input: string, actual: string, expected: string): Promise<any> {
  const responseText = await ReliabilityService.withBackoff(
    async () => callGemini({
      prompt: `CONTEXT:\nInput: ${input}\nActual Output: ${actual}\nExpected: ${expected}`,
      systemInstruction: "You are a professional AI evaluation judge. Analyze faithfulness, relevance, and coherence. Return JSON. The analysis/reasoning MUST BE IN SPANISH.",
      jsonMode: true
    }),
    { onRetry: (i) => logger.info(`Evaluate Retry ${i}`) }
  );
  return JSON.parse(responseText || '{}');
}

export async function battlePrompts(promptA: string, promptB: string, context: string): Promise<BattleResult> {
  const responseText = await ReliabilityService.withBackoff(
    async () => callGemini({
      prompt: `PROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}\n\nTEST CONTEXT:\n${context}\n\nRESPONSE FORMAT (JSON):\n{\n  "winner": "A" | "B" | "Tie",\n  "reasoning": "Detailed comparison explanation",\n  "scoreA": number (0-100),\n  "scoreB": number (0-100)\n}`,
      systemInstruction: "Compare these two prompt architectures and determine the winner based on structural integrity and clarity. Return JSON.",
      jsonMode: true
    }),
    { onRetry: (i) => logger.info(`Battle Retry ${i}`) }
  );
  return ParserService.parseJson(responseText, BattleResultSchema) as BattleResult;
}

/**
 * SIPDO: SYNTHETIC DATA GENERATION
 */
export async function generateTestCases(promptA: string, promptB: string, globalContext: string = ""): Promise<Record<string, string>[]> {
  const GENERATOR_SYSTEM_PROMPT = `
Eres un Ingeniero de QA (Quality Assurance) experto en romper sistemas de IA (Red Teaming).
Tu objetivo es generar 3 casos de prueba ("Inputs") para evaluar la robustez de un Prompt de usuario.

Analiza el PROMPT DEL USUARIO. Si detectas que pide JSON, Código o Llamadas a Funciones, ADAPTA los casos para validar esquemas profundos.

Genera un objeto JSON con 3 casos de prueba:

1. "simple": Un caso ideal, claro y directo.
2. "complex":
   - Si el prompt es TEXTO: Un caso con ruido, ambigüedad o datos irrelevantes.
   - Si el prompt es TOOL/JSON: Un caso donde falten parámetros opcionales o los tipos de datos sean confusos (ej. string "123" en lugar de número).
3. "edge_case": Intento de romper la lógica (Inyección, Datos Null, Idioma cruzado).

Salida esperada (JSON estricto):
{
  "simple": "string con el input",
  "complex": "string con el input",
  "edge_case": "string con el input"
}
`;

  try {
    const response = await callGemini({
      prompt: `CONTEXT:\n${globalContext}\n\nPROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}`,
      systemInstruction: GENERATOR_SYSTEM_PROMPT,
      jsonMode: true,
      temperature: 0.8
    });

    const schema = z.object({
      simple: z.string(),
      complex: z.string(),
      edge_case: z.string()
    });

    const cases = ParserService.parseJson(response, schema);

    return [
      { type: "Simple", input: cases.simple },
      { type: "Complex", input: cases.complex },
      { type: "Edge Case", input: cases.edge_case }
    ];

  } catch (error) {
    logger.error("SIPDO Generation Failed:", error);
    return [
      { type: "Simple", input: "Test Input 1" },
      { type: "Complex", input: "Test Input 2" },
      { type: "Edge Case", input: "" }
    ];
  }
}

/**
 * HALLUCINATION CHECK - Enhanced with ICE Method
 * ICE = Instrucciones, Restricciones, Escalada
 */
export async function verifyHallucinations(input: string, output: string, sourceContext: string): Promise<{ score: number, issues: string[], riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }> {
  if (!sourceContext || sourceContext.length < 50) return { score: 100, issues: [], riskLevel: 'LOW' };

  const ICE_SYSTEM_PROMPT = `Eres un Verificador de Hechos con el MÉTODO ICE:

INSTRUCCIONES:
- Identifica CADA afirmación factual en el output
- Verifica cada afirmación contra la fuente proporcionada
- Marca como "issue" cualquier dato NO respaldado por la fuente

RESTRICCIONES:
- Si no hay evidencia suficiente para una afirmación → issue
- Si encuentras datos numéricos sin fuente → issue
- Score < 50 si hay MÁS DE 3 issues

ESCALADA:
- Si encuentras > 3 issues → riskLevel = "HIGH"
- Si encuentras 1-3 issues → riskLevel = "MEDIUM"
- Si no hay issues → riskLevel = "LOW"

Return JSON en español. Sea riguroso.`;

  const responseText = await ReliabilityService.withBackoff(
    async () => callGemini({
      prompt: `
      FUENTE (Ground Truth):
      ${sourceContext.substring(0, 3000)}

      OUTPUT DEL MODELO A VERIFICAR:
      ${output.substring(0, 2000)}

      Analiza y devuelve JSON:
      {
        "score": number (0-100, 100 = Sin alucinaciones),
        "issues": ["lista de afirmaciones no respaldadas..."],
        "riskLevel": "LOW" | "MEDIUM" | "HIGH"
      }
      `,
      systemInstruction: ICE_SYSTEM_PROMPT,
      jsonMode: true,
      temperature: 0.1 // Factual mode
    }),
    { onRetry: (i) => logger.info(`[ICE] Hallucination Check Retry ${i}`) }
  );

  const schema = z.object({
    score: z.number(),
    issues: z.array(z.string()),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('LOW')
  });

  const result = ParserService.parseJson(responseText, schema);
  return {
    score: result.score,
    issues: result.issues,
    riskLevel: result.riskLevel || 'LOW'
  };
}

// Utility: Re-export robust parser if someone needs it manually
export const safeJsonParse = ParserService.parseJson;
