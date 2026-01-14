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
  signal
}: {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  model?: string;
  temperature?: number;
  attachments?: Attachment[];
  signal?: AbortSignal;
}) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("PROD_FATAL: API_KEY is missing from execution environment.");

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
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 120000); // 120s timeout
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
    has_role: z.boolean(),
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
  const sanitized = text.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, "$1").trim();
  try {
    const json = JSON.parse(sanitized);
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("ZOD VALIDATION ERROR:", JSON.stringify(error.format(), null, 2));
      console.error("RAW JSON:", text);
      throw new Error(`DATA_INTEGRITY_ERROR: Validation failed.`);
    }
    throw new Error("SYNTAX_ERROR: Failed to decode model output.");
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

    const responseText = await withBackoff(
      () => callGemini({
        prompt: `GLOBAL CONTEXT:\n${globalContext || "None provided."}\n\nCONTEXT HISTORY:\n${historyCtx}\n\nCURRENT INPUT: ${input}\n\nAnalyze if we have enough detail. If the GLOBAL CONTEXT provides the necessary code or information referenced in the INPUT, or if this input is an answer to a previous question, consider it as READY_TO_OPTIMIZE.\n\nRESPONSE FORMAT (JSON):\n{\n  "status": "READY_TO_OPTIMIZE" | "NEEDS_CLARIFICATION",\n  "clarification_question": "Solo si el estado es NEEDS_CLARIFICATION. Pregunta aclaratoria en ESPAÑOL."\n}`,
        jsonMode: true,
        attachments,
        signal
      }),
      (msg) => onProgress?.('WAITING', `Claridad: ${msg}`)
    );
    return safeJsonParse<InterviewerResponse>(responseText, InterviewerResponseSchema);
  }



  async optimizePromptFlow(
    originalInput: string,
    history: ChatMessage[] = [],
    onProgress?: (stage: string, detail: string) => void,
    globalContext: string = '',
    attempts: number = 0,
    signal?: AbortSignal,
    attachments: Attachment[] = []
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
            ? `Mejorando diseño... (Intento ${currentAttempt + 1})`
            : `Diseñando arquitectura...`
        );

        // 1. CALL ARCHITECT
        // We inject the "critiqueHistory" so the architect knows what failed previously
        const architectResponseText = await withBackoff(
          () => callGemini({
            prompt: `CONVERSATION HISTORY:\n${historyCtx}\n\nUSER INTENT:\n${originalInput}`,
            systemInstruction: GET_ARCHITECT_PROMPT(critiqueHistory, memoryContext, globalContext),
            jsonMode: true,
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

  return await service.optimizePromptFlow(currentPrompt, history, onProgress, contextData || '', 0, options?.signal, options?.attachments);
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
  return safeJsonParse<BattleResult>(responseText, BattleResultSchema);
}

