import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { z } from "zod";
import { AI_CONFIG } from "../config/aiConfig";
import { GET_ARCHITECT_PROMPT, CRITIC_PROMPT } from "../config/systemPrompts";
import { BattleResult } from "../types";
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
  temperature = AI_CONFIG.GENERATION_CONFIG.temperature
}: {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  model?: string;
  temperature?: number;
}) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("PROD_FATAL: API_KEY is missing from execution environment.");

  // Initialize client dynamically per request to ensure up-to-date config
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: jsonMode ? "application/json" : "text/plain",
      temperature,
      topP: AI_CONFIG.GENERATION_CONFIG.topP,
      topK: AI_CONFIG.GENERATION_CONFIG.topK,
      // Safety Settings: BLOCK_ONLY_HIGH to minimize false positives during debugging
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    },
  });

  return response.text || "";
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

  async assessInputClarity(input: string, history: ChatMessage[] = [], globalContext: string = ''): Promise<InterviewerResponse> {
    const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const responseText = await withBackoff(
      () => callGemini({
        prompt: `GLOBAL CONTEXT:\n${globalContext || "None provided."}\n\nCONTEXT HISTORY:\n${historyCtx}\n\nCURRENT INPUT: ${input}\n\nAnalyze if we have enough detail. If the GLOBAL CONTEXT provides the necessary code or information referenced in the INPUT, or if this input is an answer to a previous question, consider it as READY_TO_OPTIMIZE.\n\nRESPONSE FORMAT (JSON):\n{\n  "status": "READY_TO_OPTIMIZE" | "NEEDS_CLARIFICATION",\n  "clarification_question": "Only if status is NEEDS_CLARIFICATION"\n}`,
        jsonMode: true
      }),
      () => { }
    );
    return safeJsonParse<InterviewerResponse>(responseText, InterviewerResponseSchema);
  }

  async optimizePromptFlow(
    originalInput: string,
    history: ChatMessage[] = [],
    onProgress?: (stage: string, detail: string) => void,
    globalContext: string = '',
    attempts: number = 0
  ): Promise<OptimizationResult> {
    try {
      const memoryContext = MemoryService.getMemoryString();
      const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      onProgress?.('ARCHITECT', `Diseñando arquitectura (Intento ${attempts + 1})...`);
      const architectResponseText = await withBackoff(
        () => callGemini({
          prompt: `CONVERSATION HISTORY:\n${historyCtx}\n\nUSER INTENT:\n${originalInput}`,
          systemInstruction: GET_ARCHITECT_PROMPT("First draft or refinement phase.", memoryContext, globalContext),
          jsonMode: true
        }),
        (msg) => onProgress?.('WAITING', msg)
      );

      const archData = safeJsonParse<ArchitectResponse>(architectResponseText, ArchitectResponseSchema);

      onProgress?.('CRITIC', `Auditando calidad estructural...`);
      const criticResponseText = await withBackoff(
        () => callGemini({
          prompt: `PROMPT:\n${archData.refined_prompt}`,
          systemInstruction: CRITIC_PROMPT,
          jsonMode: true
        }),
        (msg) => onProgress?.('WAITING', msg)
      );

      const criticData = safeJsonParse<CriticResponse>(criticResponseText, CriticResponseSchema);

      const finalResult: OptimizationResult = {
        refinedPrompt: archData.refined_prompt,
        metadata: {
          thinkingProcess: archData.thinking_process,
          changesMade: archData.changes_made,
          criticScore: criticData.clarity_score,
          rubricChecks: criticData.rubric_checks,
        }
      };

      this.lastValidResult = finalResult;

      if (criticData.clarity_score >= AI_CONFIG.MIN_QUALITY_SCORE || attempts >= AI_CONFIG.MAX_RETRIES - 1) {
        onProgress?.('COMPLETE', 'Optimización exitosa.');
        return finalResult;
      }

      onProgress?.('REFINING', `Score: ${criticData.clarity_score}. Mejorando...`);
      return this.optimizePromptFlow(originalInput, history, onProgress, globalContext, attempts + 1);

    } catch (err) {
      if (this.lastValidResult) {
        onProgress?.('RECOVERY', 'Fallo detectado. Restaurando borrador parcial.');
        return { ...this.lastValidResult, partialSuccess: true };
      }
      throw err;
    }
  }
}

/**
 * PUBLIC ADAPTERS
 */
export async function optimizePrompt(
  content: string,
  history: ChatMessage[] = [],
  onProgress?: (stage: string, detail: string) => void,
  globalContext: string = '',
  options?: { skipInterviewer?: boolean }
): Promise<OptimizationResult | InterviewerResponse> {
  const service = new PromptOptimizationService();
  onProgress?.('START', 'Iniciando pipeline cognitivo...');

  if (!options?.skipInterviewer) {
    const clarity = await service.assessInputClarity(content, history, globalContext);
    if (clarity.status === "NEEDS_CLARIFICATION") return clarity;
  }

  return await service.optimizePromptFlow(content, history, onProgress, globalContext);
}

export async function runPrompt(prompt: string, variables: Record<string, string>): Promise<string> {
  let finalPrompt = prompt;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    finalPrompt = finalPrompt.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, "g"), value || "");
  }
  return await callGemini({ prompt: finalPrompt });
}

export async function evaluateResponse(input: string, actual: string, expected: string): Promise<any> {
  const responseText = await withBackoff(
    () => callGemini({
      prompt: `CONTEXT:\nInput: ${input}\nActual Output: ${actual}\nExpected: ${expected}`,
      systemInstruction: "You are a professional AI evaluation judge. Analyze faithfulness, relevance, and coherence. Return JSON.",
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
