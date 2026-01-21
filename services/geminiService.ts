import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { z } from "zod";
import { AI_CONFIG } from "../config/aiConfig";
import { GET_ARCHITECT_PROMPT, CRITIC_PROMPT } from "../config/systemPrompts";
import { BattleResult, Attachment } from "../types";
import { MemoryService } from "./memoryService";
/**
 * NEW RICH RETURN TYPE: OptimizationResult
 */
export interface OptimizationResult {
  refinedPrompt: string;
  metadata: {
    thinkingProcess: string;
    changesMade: string[];
    criticScore: number;
    rubricChecks: Record<string, boolean>;
  };
  partialSuccess?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ROBUST GENERATE CONTENT HELPER (Tier-1 Standard)
 * Implements the official @google/genai integration.
 * - Dynamic instantiation for security.
 * - Centralized safety and generation config.
 * - JSON and Text modality support.
 */
export async function callGemini({
  prompt,
  systemInstruction,
  jsonMode = false,
  model = AI_CONFIG.MODEL_ID,
  temperature = AI_CONFIG.GENERATION_CONFIG.temperature,
  attachments,
  signal,
  timeout
}: {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  model?: string;
  temperature?: number;
  attachments?: Attachment[];
  signal?: AbortSignal;
  timeout?: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error("PROD_FATAL: API_KEY/GEMINI_API_KEY is missing from execution environment.");

  // Initialize client dynamically per request to ensure up-to-date config
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [{ text: prompt }];

  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.type,
          data: att.data
        }
      });
    });
  }

  try {
    console.log(`[GeminiService] Sending request to model: ${model}`);

    // Create a timeout promise
    // Create a timeout promise
    const timeoutMs = arguments[0].timeout || 180000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    });

    // Use the correct SDK method for @google/genai
    const requestPromise = ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction,
        responseMimeType: jsonMode ? "application/json" : "text/plain",
        temperature,
        topP: AI_CONFIG.GENERATION_CONFIG.topP,
        topK: AI_CONFIG.GENERATION_CONFIG.topK,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ]
      },
    });

    const response: any = await Promise.race([requestPromise, timeoutPromise]);

    // Manual abort check since SDK might not support signal propagation deep down yet
    if (signal?.aborted) {
      throw new Error('ABORTED');
    }

    console.log(`[GeminiService] Response received.`);

    // Handle potential SDK differences (function vs property)
    if (typeof response.text === 'function') {
      return response.text();
    }
    return response.text || "";

  } catch (err: any) {
    console.error("[GeminiService] Error:", err);
    if (err.message === "TIMEOUT") {
      throw new Error("TIMEOUT: La API tardó demasiado en responder.");
    }
    throw err;
  }
}

/**
 * SCHEMAS for Zod Validation
 */
export const ArchitectResponseSchema = z.object({
  thinking_process: z.string().optional().default("Thinking..."),
  refined_prompt: z.string(),
  changes_made: z.array(z.string()).optional().default([]),
});

export const CriticResponseSchema = z.object({
  safety_pass: z.boolean(),
  clarity_score: z.number().min(0).max(100),
  rubric_checks: z.object({
    has_thinking_protocol: z.boolean().optional().default(false),
    has_artifact_protocol: z.boolean().optional().default(false),
    no_ambiguity: z.boolean(),
  }),
  feedback: z.string(),
});

export const InterviewerResponseSchema = z.object({
  status: z.enum(["READY_TO_OPTIMIZE", "NEEDS_CLARIFICATION"]),
  clarification_question: z.string().nullish(),
});

export type ArchitectResponse = z.infer<typeof ArchitectResponseSchema>;
export type CriticResponse = z.infer<typeof CriticResponseSchema>;
export type InterviewerResponse = z.infer<typeof InterviewerResponseSchema>;

export const BattleResultSchema = z.object({
  winner: z.enum(['A', 'B', 'Tie']),
  reasoning: z.string(),
  scoreA: z.number().max(100),
  scoreB: z.number().max(100),
  error: z.string().optional(),
});

/**
 * UTILS: ROBUST PARSING
 */
export function safeJsonParse<T>(text: string | undefined, schema: z.ZodSchema<T>): T {
  if (!text) throw new Error("API_ERROR: Received empty response.");

  // ROBUST PARSING STRATEGY (Scientific Improvement)
  // Instead of simple regex, we extract the first '{' and last '}' to isolate the JSON object
  // This allows "Reasoning Traces" to exist before the JSON block without breaking the parser.
  let jsonString = text;
  const jsonStartIndex = text.indexOf('{');
  const jsonEndIndex = text.lastIndexOf('}');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
    jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  // Fallback cleanup if extraction didn't work perfectly or if it's already clean
  const sanitized = jsonString.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, "$1").trim();

  try {
    const json = JSON.parse(sanitized);
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("ZOD VALIDATION ERROR:", JSON.stringify(error.format(), null, 2));
      console.error("RAW JSON:", text);
      throw new Error(`DATA_INTEGRITY_ERROR: Validation failed.`);
    }
    // Retry with aggressive cleanup for common LLM markdown errors
    try {
      const agressiveClean = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      const json = JSON.parse(agressiveClean);
      return schema.parse(json);
    } catch (e2) {
      throw new Error("SYNTAX_ERROR: Failed to decode model output.");
    }
  }
}

/**
 * RETRY UTILITY: EXPONENTIAL BACKOFF
 */
async function withBackoff<T>(fn: () => Promise<T>, onRetry: (msg: string) => void, maxRetries = 3): Promise<T> {
  let delay = 2000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable = err?.message?.includes('429') || err?.message?.includes('503') || err?.message?.includes('quota');
      if (isRetryable && i < maxRetries - 1) {
        onRetry(`WAITING: Servicio saturado. Reintentando en ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("MAX_RETRIES_EXCEEDED");
}

/**
 * CORE SERVICE: PromptOptimizationService
 */
export class PromptOptimizationService {
  private lastValidResult: OptimizationResult | null = null;

  async assessInputClarity(
    input: string,
    history: ChatMessage[] = [],
    globalContext: string = '',
    attachments: Attachment[] = [],
    signal?: AbortSignal,
    onProgress?: (stage: string, detail: string) => void
  ): Promise<InterviewerResponse> {
    const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // Notify we are starting the analysis
    onProgress?.('ANALYSIS', 'Analizando claridad de la intención...');

    console.log('[GeminiService] Starting assessInputClarity...');

    try {
      // Use a shorter timeout logic here or rely on callGemini's timeout but we want it fast
      const responseText = await withBackoff(
        () => callGemini({
          prompt: `GLOBAL CONTEXT:\n${globalContext || "None provided."}\n\nCONTEXT HISTORY:\n${historyCtx}\n\nCURRENT INPUT: ${input}\n\nAnalyze if we have enough detail. If the GLOBAL CONTEXT provides the necessary code or information referenced in the INPUT, or if this input is an answer to a previous question, consider it as READY_TO_OPTIMIZE.\n\nRESPONSE FORMAT (JSON):\n{\n  "status": "READY_TO_OPTIMIZE" | "NEEDS_CLARIFICATION",\n  "clarification_question": "Solo si el estado es NEEDS_CLARIFICATION. Pregunta aclaratoria en ESPAÑOL."\n}`,
          jsonMode: true,
          attachments,
          signal,
          timeout: 30000 // 30s timeout for clarity check (Fail Fast)
        }),
        (msg) => onProgress?.('WAITING', `Claridad: ${msg}`)
      );

      console.log('[GeminiService] assessInputClarity response received:', responseText);
      return safeJsonParse<InterviewerResponse>(responseText, InterviewerResponseSchema);

    } catch (error: any) {
      console.error('[GeminiService] assessInputClarity failed:', error);

      // Fail gracefully: if clarity check fails, assume we can proceed to optimization
      // checking if it's a critical error or just a timeout/glitch
      if (error.message?.includes('TIMEOUT') || error.message?.includes('ABORTED')) {
        // Should we bubble up or assume ready? 
        // For a better UX, if clarity check hangs, let's just proceed to try optimization
        // or let the user know. 
        // The user said it "hangs", so we must return something to unblock.
        console.warn('[GeminiService] Clarity check timed out or failed. Defaulting to READY_TO_OPTIMIZE.');
        return { status: 'READY_TO_OPTIMIZE' };
      }
      throw error;
    }
  }



  async optimizePromptFlow(
    originalInput: string,
    history: ChatMessage[] = [],
    onProgress?: (stage: string, detail: string) => void,
    globalContext: string = '',
    attempts: number = 0,
    signal?: AbortSignal,
    attachments: Attachment[] = [],
    targetModel: string = 'gemini-3-pro-preview' // New Param
  ): Promise<OptimizationResult> {
    const memoryContext = MemoryService.getMemoryString();

    // Flatten history for the prompt context
    const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    let critiqueHistory = "";
    let currentAttempt = 0;
    const maxRetries = AI_CONFIG.MAX_RETRIES; // typically 3

    while (currentAttempt <= maxRetries) {
      try {
        const isRetry = currentAttempt > 0;
        const stageLabel = isRetry ? `REFINING (${currentAttempt}/${maxRetries})` : 'ARCHITECT';

        onProgress?.(isRetry ? 'REFINING' : 'ARCHITECT',
          isRetry
            ? `Mejorando (Intento ${currentAttempt + 1}) | Target: ${targetModel}`
            : `Diseñando arquitectura V2 (XML) para ${targetModel}...`
        );

        // 1. CALL ARCHITECT
        // We inject the "critiqueHistory" so the architect knows what failed previously
        // CRITICAL PERFORMANCE FIX: "Thinking" models usually struggle with forced JSON Mode.
        // We set jsonMode: false and rely on 'safeJsonParse' to extract the JSON block.
        const architectResponseText = await withBackoff(
          () => callGemini({
            prompt: `CONVERSATION HISTORY:\n${historyCtx}\n\nUSER INTENT:\n${originalInput}`,
            systemInstruction: GET_ARCHITECT_PROMPT(critiqueHistory, memoryContext, globalContext, targetModel),
            jsonMode: false, // DISABLED JSON MODE TO ALLOW THINKING
            attachments,
            signal
          }),
          (msg) => onProgress?.('WAITING', msg)
        );

        const archData = safeJsonParse<ArchitectResponse>(architectResponseText, ArchitectResponseSchema);

        // 2. CALL CRITIC
        onProgress?.('CRITIC', `Auditando calidad estructural...`);
        const criticResponseText = await withBackoff(
          () => callGemini({
            prompt: `PROMPT:\n${archData.refined_prompt}`,
            systemInstruction: CRITIC_PROMPT,
            jsonMode: true,
            signal
          }),
          (msg) => onProgress?.('WAITING', msg)
        );

        const criticData = safeJsonParse<CriticResponse>(criticResponseText, CriticResponseSchema);

        // 3. CONSTRUCT RESULT
        const finalResult: OptimizationResult = {
          refinedPrompt: archData.refined_prompt,
          metadata: {
            thinkingProcess: archData.thinking_process,
            changesMade: archData.changes_made,
            criticScore: criticData.clarity_score,
            rubricChecks: criticData.rubric_checks,
          }
        };

        // Update fallback check
        this.lastValidResult = finalResult;

        // 4. CHECK SUCCESS
        if (criticData.clarity_score >= AI_CONFIG.MIN_QUALITY_SCORE) {
          onProgress?.('COMPLETE', 'Optimización exitosa.');
          return finalResult;
        }

        // 5. PREPARE FOR NEXT ITERATION (IF ANY)
        if (currentAttempt < maxRetries) {
          onProgress?.('REFINING', `Score: ${criticData.clarity_score}. Aplicando feedback del crítico...`);

          // Append to critique history for the next Architect call
          critiqueHistory += `\n[Attempt ${currentAttempt + 1}]\nDraft:\n${archData.refined_prompt}\n\nScore: ${criticData.clarity_score}\nFeedback: ${criticData.feedback}\n-------------------\n`;

          currentAttempt++;
        } else {
          // Max retries reached, return best effort
          onProgress?.('COMPLETE', 'Máximo de intentos alcanzado. Entregando mejor resultado.');
          return finalResult;
        }

      } catch (err) {
        // If an error occurs (network, etc), try to return partial if we have it, else throw
        if (this.lastValidResult) {
          onProgress?.('RECOVERY', 'Fallo detectado. Restaurando borrador parcial.');
          return { ...this.lastValidResult, partialSuccess: true };
        }
        throw err;
      }
    }

    // Should theoretically be unreachable due to return in loop, but safe fallback
    if (this.lastValidResult) return this.lastValidResult;
    throw new Error("Optimization flow failed to produce a result.");
  }
}

/**
 * PUBLIC ADAPTERS
 */
export const optimizePrompt = async (
  currentPrompt: string,
  history: ChatMessage[] = [],
  onProgress?: (stage: string, detail: string) => void,
  contextData?: string,
  options?: { skipInterviewer?: boolean; model?: string; signal?: AbortSignal, attachments?: Attachment[] }
): Promise<OptimizationResult | InterviewerResponse> => {
  const service = new PromptOptimizationService();
  onProgress?.('START', 'Iniciando pipeline cognitivo...');

  if (!options?.skipInterviewer) {
    const clarity = await service.assessInputClarity(currentPrompt, history, contextData || '', options?.attachments, options?.signal, onProgress);
    if (clarity.status === "NEEDS_CLARIFICATION") return clarity;
  }

  return await service.optimizePromptFlow(
    currentPrompt,
    history,
    onProgress,
    contextData || '',
    0,
    options?.signal,
    options?.attachments,
    options?.model // Pass the target model (e.g., user selected "gemini-3-flash")
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
  const responseText = await withBackoff(
    () => callGemini({
      prompt: `CONTEXT:\nInput: ${input}\nActual Output: ${actual}\nExpected: ${expected}`,
      systemInstruction: "You are a professional AI evaluation judge. Analyze faithfulness, relevance, and coherence. Return JSON. The analysis/reasoning MUST BE IN SPANISH.",
      jsonMode: true
    }),
    () => { }
  );
  return JSON.parse(responseText || '{}');
}

export async function battlePrompts(promptA: string, promptB: string, context: string): Promise<BattleResult> {
  const responseText = await withBackoff(
    () => callGemini({
      prompt: `PROMPT A:\n${promptA}\n\nPROMPT B:\n${promptB}\n\nTEST CONTEXT:\n${context}\n\nRESPONSE FORMAT (JSON):\n{\n  "winner": "A" | "B" | "Tie",\n  "reasoning": "Detailed comparison explanation",\n  "scoreA": number (0-100),\n  "scoreB": number (0-100)\n}`,
      systemInstruction: "Compare these two prompt architectures and determine the winner based on structural integrity and clarity. Return JSON.",
      jsonMode: true
    }),
    () => { }
  );
  return safeJsonParse(responseText, BattleResultSchema) as BattleResult;
}

/**
 * SIPDO: SYNTHETIC DATA GENERATION (Scientific Improvement)
 * Generates 3 distinct test cases to rigorously evaluate prompt robustness.
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
      temperature: 0.8 // High creativity for attacks
    });

    const schema = z.object({
      simple: z.string(),
      complex: z.string(),
      edge_case: z.string()
    });

    const cases = safeJsonParse(response, schema);

    // Map back to the format expected by the Battle UI
    return [
      { type: "Simple", input: cases.simple },
      { type: "Complex", input: cases.complex },
      { type: "Edge Case", input: cases.edge_case }
    ];

  } catch (error) {
    console.error("SIPDO Generation Failed:", error);
    // Fallback if generation fails
    return [
      { type: "Simple", input: "Test Input 1" },
      { type: "Complex", input: "Test Input 2" },
      { type: "Edge Case", input: "" } // Empty string is a valid edge case
    ];
  }
}

/**
 * HALLUCINATION CHECK (Deep Analysis Mode)
 * Uses QA-Prompting to verify factual consistency against source context.
 */
export async function verifyHallucinations(input: string, output: string, sourceContext: string): Promise<{ score: number, issues: string[] }> {
  if (!sourceContext || sourceContext.length < 50) return { score: 100, issues: [] }; // Cannot verify without context

  const responseText = await withBackoff(
    () => callGemini({
      prompt: `
      SOURCE TEXT:
      ${sourceContext}

      MODEL OUTPUT:
      ${output}

      TASK:
      Verify if the MODEL OUTPUT contains any claims NOT supported by the SOURCE TEXT (Hallucinations).
      
      INSTRUCTIONS:
      1. Identify all claims in the Output.
      2. Check each claim against the Source.
      3. Flag unsupported claims.

      RESPONSE FORMAT (JSON):
      {
        "score": number (0-100, 100 = No Hallucinations),
        "issues": ["List of unsupported claims..."]
      }
      `,
      systemInstruction: "You are a Fact-Checking AI. Be extremely strict. Return JSON.",
      jsonMode: true
    }),
    () => { }
  );

  const schema = z.object({
    score: z.number(),
    issues: z.array(z.string())
  });

  return safeJsonParse(responseText, schema) as { score: number, issues: string[] };
}


