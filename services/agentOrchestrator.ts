
import { logger } from "./loggerService";
import {
    OptimizationResult,
    ArchitectResponse,
    ArchitectResponseSchema,
    CriticResponse,
    CriticResponseSchema,
    InterviewerResponse,
    InterviewerResponseSchema,
    RequirementsResponseSchema,
    DesignResponseSchema,
    TasksResponseSchema
} from "./schemas";
import { ReliabilityService } from "./reliabilityService";
import { ParserService } from "./parserService";
import { callGemini } from "./aiTransport";
import { ChatMessage } from "../types";

import { AI_CONFIG } from "../config/aiConfig";
import { GET_ARCHITECT_PROMPT, CRITIC_PROMPT } from "../config/systemPrompts";
import { GET_REQUIREMENTS_PROMPT, GET_DESIGN_PROMPT, GET_TASKS_PROMPT } from "../config/architectPrompts";
import { MemoryService } from "./memoryService";
import { Attachment } from "../types";

export class AgentOrchestrator {
    private lastValidResult: OptimizationResult | null = null;

    /**
     * Determines if the input needs clarification before optimization.
     */
    async assessInputClarity(
        input: string,
        history: ChatMessage[] = [],
        globalContext: string = '',
        attachments: Attachment[] = [],
        signal?: AbortSignal,
        onProgress?: (stage: string, detail: string) => void
    ): Promise<InterviewerResponse> {
        const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        onProgress?.('ANALYSIS', 'Analizando claridad de la intención...');

        // Dynamic import to avoid circular dependencies if systemPrompts imports something heavy
        const { GET_CLARITY_AGENT_PROMPT } = await import("../config/systemPrompts");

        try {
            const responseText = await ReliabilityService.withBackoff(
                () => callGemini({
                    prompt: `ANALYZE THIS INTERACTION:`,
                    systemInstruction: GET_CLARITY_AGENT_PROMPT(globalContext || "None", historyCtx, input),
                    jsonMode: true,
                    attachments,
                    signal,
                    timeout: 60000
                }),
                {
                    onRetry: (attempt, err) => onProgress?.('WAITING', `Claridad (Intento ${attempt}): ${err.message}`)
                }
            );

            return ParserService.parseJson<InterviewerResponse>(responseText, InterviewerResponseSchema);

        } catch (error: any) {
            logger.warn('[AgentOrchestrator] Clarity check failed/timed out. Defaulting to READY.', { error });
            // Non-blocking failure
            return { status: 'READY_TO_OPTIMIZE' };
        }
    }

    /**
     * Core Architect-Critic Loop
     */
    async optimizePromptFlow(
        originalInput: string,
        history: ChatMessage[] = [],
        onProgress?: (stage: string, detail: string) => void,
        globalContext: string = '',
        signal?: AbortSignal,
        attachments: Attachment[] = [],
        targetModel: string = 'gemini-3-pro-preview',
        subType?: 'CODING' | 'PLANNING' | 'WRITING' | 'GENERAL',
        vibeContext?: string,
        knowledgeContext?: string
    ): Promise<OptimizationResult> {
        const memoryContext = MemoryService.getMemoryString();
        const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        let critiqueHistory = "";
        let currentAttempt = 0;
        const maxRetries = AI_CONFIG.MAX_RETRIES;

        while (currentAttempt <= maxRetries) {
            try {
                const isRetry = currentAttempt > 0;

                onProgress?.(isRetry ? 'REFINING' : 'ARCHITECT',
                    isRetry
                        ? `Mejorando (Intento ${currentAttempt + 1}/${maxRetries + 1})`
                        : `Diseñando arquitectura V2 (${subType || 'GENERAL'})...`
                );

                // 1. ARCHITECT
                const architectResponseText = await ReliabilityService.withBackoff(
                    () => callGemini({
                        prompt: `CONVERSATION HISTORY:\n${historyCtx}\n\nUSER INTENT:\n${originalInput}`,
                        systemInstruction: GET_ARCHITECT_PROMPT(critiqueHistory, memoryContext, globalContext, targetModel, subType, vibeContext, knowledgeContext),
                        jsonMode: false, // Let thinking models think
                        attachments,
                        signal
                    }),
                    { onRetry: (i, e) => onProgress?.('WAITING', `Architect (Retry ${i}): ${e.message}`) }
                );

                const archData = ParserService.parseJson<ArchitectResponse>(architectResponseText, ArchitectResponseSchema);

                // 2. CRITIC
                onProgress?.('CRITIC', `Auditando calidad...`);
                const criticResponseText = await ReliabilityService.withBackoff(
                    () => callGemini({
                        prompt: `PROMPT:\n${archData.refined_prompt}`,
                        systemInstruction: CRITIC_PROMPT,
                        jsonMode: true,
                        signal
                    }),
                    { onRetry: (i, e) => onProgress?.('WAITING', `Critic (Retry ${i}): ${e.message}`) }
                );

                const criticData = ParserService.parseJson<CriticResponse>(criticResponseText, CriticResponseSchema);

                // 3. RESULT
                const finalResult: OptimizationResult = {
                    refinedPrompt: archData.refined_prompt,
                    metadata: {
                        thinkingProcess: archData.thinking_process as string,
                        changesMade: archData.changes_made as string[],
                        criticScore: criticData.clarity_score,
                        rubricChecks: criticData.rubric_checks,
                    }
                };

                this.lastValidResult = finalResult;

                if (criticData.clarity_score >= AI_CONFIG.MIN_QUALITY_SCORE) {
                    onProgress?.('COMPLETE', 'Optimización exitosa.');
                    return finalResult;
                }

                if (currentAttempt < maxRetries) {
                    onProgress?.('REFINING', `Score: ${criticData.clarity_score}. Aplicando feedback...`);
                    critiqueHistory += `\n[Attempt ${currentAttempt + 1}]\nDraft:\n${archData.refined_prompt}\n\nScore: ${criticData.clarity_score}\nFeedback: ${criticData.feedback}\n-------------------\n`;
                    currentAttempt++;
                } else {
                    onProgress?.('COMPLETE', 'Máximo de intentos alcanzado.');
                    return finalResult;
                }

            } catch (err: any) {
                if (this.lastValidResult) {
                    onProgress?.('RECOVERY', 'Fallo parcial. Restaurando versión anterior.');
                    return { ...this.lastValidResult, partialSuccess: true };
                }
                throw err;
            }
        }

        if (this.lastValidResult) return this.lastValidResult;
        throw new Error("Optimization flow failed.");
    }

    /**
     * V2 Spec Architect Flow
     */
    async runSpecArchitectFlow(
        input: string,
        history: ChatMessage[],
        onProgress?: (stage: string, detail: string) => void,
        signal?: AbortSignal
    ): Promise<OptimizationResult> {
        const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        // Simple state heuristics
        const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant');
        let nextStage: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' = 'REQUIREMENTS';

        if (lastAssistantMsg) {
            if (lastAssistantMsg.content.includes("thought_process") && lastAssistantMsg.content.includes("questions")) {
                nextStage = 'DESIGN';
            } else if (lastAssistantMsg.content.includes("mermaid_diagram")) {
                nextStage = 'TASKS';
            }
        }

        onProgress?.('ARCHITECT', `Spec Layout Stage: ${nextStage}`);

        let responseJson: any;
        let refinedPrompt = "";

        // Common call helper
        const callSpecAgent = async (instruction: string, prompt: string, schema: any) => {
            const txt = await ReliabilityService.withBackoff(
                () => callGemini({ prompt, systemInstruction: instruction, jsonMode: true, signal }),
                { onRetry: (i, e) => onProgress?.('WAITING', `SpecAgent (Retry ${i}): ${e.message}`) }
            );
            return ParserService.parseJson(txt, schema);
        };

        if (nextStage === 'REQUIREMENTS') {
            responseJson = await callSpecAgent(GET_REQUIREMENTS_PROMPT(input), input, RequirementsResponseSchema);
            refinedPrompt = JSON.stringify(responseJson, null, 2);
        } else if (nextStage === 'DESIGN') {
            onProgress?.('ARCHITECT', 'Generating Architecture...');
            responseJson = await callSpecAgent(GET_DESIGN_PROMPT("See input"), `Approved requirements:\n${input}\n\nHISTORY:\n${historyCtx}`, DesignResponseSchema);
            refinedPrompt = JSON.stringify(responseJson, null, 2);
        } else if (nextStage === 'TASKS') {
            onProgress?.('ARCHITECT', 'Generating Tasks...');
            responseJson = await callSpecAgent(GET_TASKS_PROMPT("See history"), `Approved Design:\n${historyCtx}`, TasksResponseSchema);
            refinedPrompt = JSON.stringify(responseJson, null, 2);
        }

        return {
            refinedPrompt,
            metadata: {
                thinkingProcess: responseJson.thought_process,
                changesMade: ["Stage Advanced"],
                criticScore: 100,
                rubricChecks: {}
            },
            specStage: nextStage,
            artifacts: {
                requirements: nextStage === 'REQUIREMENTS' ? responseJson : undefined,
                design: nextStage === 'DESIGN' ? responseJson : undefined,
                tasks: nextStage === 'TASKS' ? responseJson : undefined,
            }
        };
    }

    /**
     * ZERO-CONFIG: Infer task type automatically from prompt content
     * @param prompt The user's input prompt
     * @returns The inferred task type
     */
    async inferTaskType(prompt: string): Promise<'CODING' | 'PLANNING' | 'WRITING' | 'GENERAL'> {
        const CLASSIFIER_PROMPT = `Clasifica este prompt en EXACTAMENTE UNA categoría:

PROMPT: "${prompt.substring(0, 500)}"

CATEGORÍAS:
- CODING: Código, programación, debugging, APIs, scripts, funciones
- PLANNING: Planes de proyecto, arquitectura, diseño de sistemas, especificaciones
- WRITING: Texto creativo, emails, documentos, marketing, copywriting
- GENERAL: Preguntas, análisis, consultas que no encajan en las anteriores

REGLAS:
1. Si menciona código, lenguajes de programación, o errores técnicos → CODING
2. Si pide un plan, diagrama, o arquitectura → PLANNING
3. Si pide redactar texto para humanos → WRITING
4. En caso de duda → GENERAL

Responde SOLO con UNA palabra (CODING, PLANNING, WRITING, o GENERAL). Sin explicación.`;

        try {
            const response = await callGemini({
                prompt: CLASSIFIER_PROMPT,
                temperature: 0.1 // Very deterministic
            });

            const category = response.trim().toUpperCase().replace(/[^A-Z]/g, '');

            if (['CODING', 'PLANNING', 'WRITING', 'GENERAL'].includes(category)) {
                logger.info(`[ZeroConfig] Inferred task type: ${category}`);
                return category as 'CODING' | 'PLANNING' | 'WRITING' | 'GENERAL';
            }

            logger.warn(`[ZeroConfig] Unknown category "${category}", defaulting to GENERAL`);
            return 'GENERAL';
        } catch (error) {
            logger.error('[ZeroConfig] Inference failed, defaulting to GENERAL', { error });
            return 'GENERAL';
        }
    }
}
