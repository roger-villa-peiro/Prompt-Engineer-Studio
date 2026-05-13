
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
import { selfRefineLoop } from "./selfRefineService";
import { ObservabilityService } from "./observabilityService";
import { runMetaPromptingFlow } from "./metaPromptService";



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
        onProgress?: (stage: string, detail: string) => void,
        codeContext: string = ''
    ): Promise<InterviewerResponse> {
        const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        onProgress?.('ANALYSIS', 'Analizando claridad de la intención...');

        // Dynamic import to avoid circular dependencies if systemPrompts imports something heavy
        const { GET_CLARITY_AGENT_PROMPT } = await import("../config/systemPrompts");

        try {
            const responseText = await ReliabilityService.withBackoff(
                () => callGemini({
                    prompt: `ANALYZE THIS INTERACTION:`,
                    systemInstruction: GET_CLARITY_AGENT_PROMPT(globalContext || "None", historyCtx, input, codeContext),
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
        targetModel: string = 'gemini-3.1-pro-preview',
        subType?: 'CODING' | 'PLANNING' | 'WRITING' | 'GENERAL',
        vibeContext?: string,
        knowledgeContext?: string,
        codeContext?: string
    ): Promise<OptimizationResult> {
        const memoryContext = MemoryService.getMemoryString();
        const historyCtx = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        // Langfuse observability trace
        const trace = ObservabilityService.startTrace({
            name: 'optimize-prompt',
            metadata: { subType, targetModel, hasVibeContext: !!vibeContext, hasKnowledge: !!knowledgeContext }
        });

        // Meta-Prompting Logic moved inside generation loop
        let enrichedKnowledge = knowledgeContext || '';

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

                // 1. ARCHITECT (or META-PROMPTING Strategy) — Generate initial draft
                let architectResponseText = "";
                let genSpan: any = null;

                // Try Meta-Prompting for complex tasks (Attempt 0 Only)
                if (currentAttempt === 0) {
                    try {
                        const contextToUse = enrichedKnowledge || globalContext || "";
                        // Check complexity inside runMetaPromptingFlow
                        const metaDraft = await runMetaPromptingFlow(originalInput, contextToUse);

                        if (metaDraft) {
                            onProgress?.('META_PROMPT', 'Task decomposed by Conductor AI. Synthesizing expert outputs...');

                            // Mock an Architect response structure for compatibility
                            const metaResponse: ArchitectResponse = {
                                refined_prompt: metaDraft,
                                thinking_process: "Task processed by Meta-Prompting Swarm (Conductor -> Experts -> Synthesizer).",
                                changes_made: ["Applied Meta-Prompting Strategy"]
                            };
                            architectResponseText = JSON.stringify(metaResponse);
                            logger.info("[Orchestrator] Meta-Prompting successful. Bypassing standard Architect.");
                        }
                    } catch (metaError: any) {
                        logger.warn("[Orchestrator] Meta-Prompting check failed, falling back to Architect.", { error: metaError });
                    }
                }

                if (!architectResponseText) {
                    genSpan = ObservabilityService.startGeneration(trace, {
                        name: `architect-attempt-${currentAttempt}`,
                        model: targetModel,
                        input: (originalInput || "").substring(0, 500),
                    });

                    architectResponseText = await ReliabilityService.withBackoff(
                        () => callGemini({
                            prompt: `TARGET TASK FOR ANALYSIS:\n"${originalInput}"\n\nTASK: Create a refined PROMPT for the above task. DO NOT execute the task itself. Output ONLY the JSON analysis.`,
                            systemInstruction: GET_ARCHITECT_PROMPT(critiqueHistory, memoryContext, globalContext, targetModel, subType, vibeContext, enrichedKnowledge || knowledgeContext, codeContext),
                            jsonMode: true,
                            attachments,
                            signal,
                            model: targetModel
                        }),
                        { onRetry: (i, e) => onProgress?.('WAITING', `Architect (Retry ${i}): ${e.message}`) }
                    );

                    if (genSpan) ObservabilityService.endGeneration(genSpan, { output: architectResponseText?.substring(0, 200) || '' });
                }

                // Parse architect with fallback extraction
                let archData: ArchitectResponse = {
                    refined_prompt: "",
                    thinking_process: "",
                    changes_made: []
                };
                try {
                    archData = ParserService.parseJson<ArchitectResponse>(architectResponseText, ArchitectResponseSchema);
                } catch (parseErr: any) {
                    logger.warn('[Orchestrator] Architect parse failed, attempting regex fallback', { error: parseErr.message });
                    const promptMatch = architectResponseText?.match(/"(?:refined_prompt|refinedPrompt)"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/)
                        || architectResponseText?.match(/(?:refined_prompt|refinedPrompt)["']?\s*:\s*["']([\s\S]*?)["'](?:\s*[,}])/);
                    if (promptMatch) {
                        archData = {
                            refined_prompt: promptMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                            thinking_process: 'Recovered via regex fallback',
                            changes_made: ['Partial recovery — full JSON parsing failed']
                        };
                        logger.info('[Orchestrator] Regex fallback extracted refined_prompt successfully');
                    } else {
                        // HEURISTIC RECOVERY: LLM returned valid JSON but with wrong keys
                        let heuristicRecovered = false;
                        try {
                            const rawJson = JSON.parse(architectResponseText || '{}');
                            if (rawJson && typeof rawJson === 'object') {
                                // Filter out keys that echo the original input
                                const ECHO_KEY_PATTERNS = /^(original|input|user|source|raw)/i;
                                const stringEntries = Object.entries(rawJson)
                                    .filter(([k, v]) => typeof v === 'string' && (v as string).length > 50)
                                    .filter(([k, _]) => !ECHO_KEY_PATTERNS.test(k));

                                // Prefer keys that suggest a refined/generated output
                                const PREFERRED_KEY_PATTERNS = /prompt|refined|result|output|task_desc|description|improved|enhanced/i;
                                const preferred = stringEntries.filter(([k]) => PREFERRED_KEY_PATTERNS.test(k));
                                const candidates = preferred.length > 0 ? preferred : stringEntries;

                                // Sort by length descending
                                candidates.sort((a, b) => (b[1] as string).length - (a[1] as string).length);

                                if (candidates.length > 0) {
                                    const [bestKey, bestValue] = candidates[0] as [string, string];

                                    // Final guard: reject if the value is a verbatim copy of the original input
                                    const normalizedBest = (bestValue as string).trim().toLowerCase();
                                    const normalizedOriginal = originalInput.trim().toLowerCase();
                                    if (normalizedBest === normalizedOriginal) {
                                        logger.warn('[Orchestrator] Heuristic recovery skipped: best value is verbatim copy of original input');
                                    } else {
                                        archData = {
                                            refined_prompt: bestValue,
                                            thinking_process: `Heuristic recovery: used key "${bestKey}" (${(bestValue as string).length} chars)`,
                                            changes_made: ['Heuristic recovery — LLM used non-standard JSON keys']
                                        };
                                        heuristicRecovered = true;
                                        logger.warn('[Orchestrator] Heuristic recovery: extracted prompt', {
                                            usedKey: bestKey,
                                            skippedKeys: Object.keys(rawJson).filter(k => ECHO_KEY_PATTERNS.test(k)),
                                            valueLength: (bestValue as string).length
                                        });
                                    }
                                }
                            }
                        } catch (jsonErr) {
                            // Not even valid JSON
                        }

                        // LAST RESORT: Direct format retry with simplified prompt
                        if (!heuristicRecovered) {
                            logger.warn('[Orchestrator] All recovery failed. Attempting direct-format retry...');
                            try {
                                const directRetryText = await callGemini({
                                    prompt: `You are a prompt engineering expert. Take this user request and create a much better, more detailed version of it as a system prompt with XML tags (<system_role>, <task>, <constraints>, <output_format>).

USER REQUEST: "${originalInput}"

Return ONLY the improved prompt text. No JSON, no explanations. Start directly with <system_role>.`,
                                    model: targetModel,
                                    temperature: 0.3,
                                    signal
                                });

                                if (directRetryText && directRetryText.trim().length > 50) {
                                    archData = {
                                        refined_prompt: directRetryText.trim(),
                                        thinking_process: 'Recovered via direct-format retry (all JSON parsing failed)',
                                        changes_made: ['Direct retry — bypassed JSON format entirely']
                                    };
                                    heuristicRecovered = true;
                                    logger.info('[Orchestrator] Direct-format retry succeeded');
                                }
                            } catch (retryErr) {
                                logger.error('[Orchestrator] Direct-format retry also failed', retryErr);
                            }
                        }

                        if (!heuristicRecovered) {
                            throw new Error(`${parseErr.message} RAW: ${architectResponseText?.substring(0, 300)}...`);
                        }
                    }
                }

                // 1.5. SELF-REFINE — Iterative improvement loop (Phase 1 upgrade)
                onProgress?.('SELF_REFINE', 'Aplicando auto-refinamiento iterativo...');
                const refineResult = await selfRefineLoop(
                    archData.refined_prompt,
                    originalInput,
                    signal ?? new AbortController().signal,
                    onProgress,
                    targetModel
                );

                // Use the refined version
                const refinedPrompt = refineResult.finalPrompt;
                logger.info(`[Orchestrator] Self-Refine complete: ${refineResult.totalIterations} iterations, delta=${refineResult.improvementDelta}, converged=${refineResult.converged}`);

                // 2. CRITIC — Evaluate the refined prompt
                onProgress?.('CRITIC', `Auditando calidad con reflexión...`);
                const criticGen = ObservabilityService.startGeneration(trace, {
                    name: `critic-attempt-${currentAttempt}`,
                    model: targetModel,
                    input: (refinedPrompt || "").substring(0, 300),
                });

                const criticResponseText = await ReliabilityService.withBackoff(
                    () => callGemini({
                        prompt: `PROMPT:\n${refinedPrompt}`,
                        systemInstruction: CRITIC_PROMPT,
                        jsonMode: true,
                        signal,
                        model: targetModel
                    }),
                    { onRetry: (i, e) => onProgress?.('WAITING', `Critic (Retry ${i}): ${e.message}`) }
                );

                ObservabilityService.endGeneration(criticGen, { output: criticResponseText?.substring(0, 200) || '' });

                // Parse critic with graceful fallback
                let criticData: CriticResponse;
                try {
                    criticData = ParserService.parseJson<CriticResponse>(criticResponseText, CriticResponseSchema);
                } catch (parseErr: any) {
                    logger.warn('[Orchestrator] Critic parse failed, using default score=60 to force re-iteration', { error: parseErr.message });
                    criticData = {
                        safety_pass: true,
                        clarity_score: 60,
                        rubric_checks: { has_thinking_protocol: false, has_artifact_protocol: false, no_ambiguity: true },
                        reflection_tokens: { is_relevant: true, is_supported: true, is_useful: true, relevance_reasoning: '' },
                        feedback: 'Critic response could not be parsed. Forcing another iteration for quality improvement.'
                    };
                }

                // Score the trace in Langfuse
                ObservabilityService.score(trace, 'critic_score', criticData.clarity_score);

                // 3. RESULT — Build with reflection tokens and Self-Refine metadata
                const finalResult: OptimizationResult = {
                    refinedPrompt,
                    metadata: {
                        thinkingProcess: archData.thinking_process as string,
                        changesMade: archData.changes_made as string[],
                        criticScore: criticData.clarity_score,
                        rubricChecks: criticData.rubric_checks as Record<string, boolean>,
                        reflectionTokens: criticData.reflection_tokens ? {
                            is_relevant: criticData.reflection_tokens.is_relevant ?? true,
                            is_supported: criticData.reflection_tokens.is_supported ?? true,
                            is_useful: criticData.reflection_tokens.is_useful ?? true,
                            relevance_reasoning: criticData.reflection_tokens.relevance_reasoning ?? '',
                        } : undefined,
                        selfRefineIterations: refineResult.totalIterations,
                        selfRefineConverged: refineResult.converged,
                        improvementDelta: refineResult.improvementDelta,
                        selfRefineHistory: refineResult.iterations,
                        securityEvents: refineResult.securityEvents,
                    }
                };

                this.lastValidResult = finalResult;

                if (criticData.clarity_score >= AI_CONFIG.MIN_QUALITY_SCORE) {
                    onProgress?.('COMPLETE', 'Optimización exitosa.');
                    ObservabilityService.flush();
                    return finalResult;
                }

                if (currentAttempt < maxRetries) {
                    onProgress?.('REFINING', `Score: ${criticData.clarity_score}. Aplicando feedback...`);
                    critiqueHistory += `\n[Attempt ${currentAttempt + 1}]\nDraft:\n${refinedPrompt}\n\nScore: ${criticData.clarity_score}\nFeedback: ${criticData.feedback}\n-------------------\n`;
                    currentAttempt++;
                } else {
                    onProgress?.('COMPLETE', 'Máximo de intentos alcanzado.');
                    ObservabilityService.flush();
                    return finalResult;
                }

            } catch (err: any) {
                if (this.lastValidResult) {
                    onProgress?.('RECOVERY', 'Fallo parcial. Restaurando versión anterior.');
                    ObservabilityService.flush();
                    return { ...this.lastValidResult, partialSuccess: true };
                }
                throw err;
            }
        }

        ObservabilityService.flush();
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

        // Common call helper with JSON toggle
        const callSpecAgent = async (instruction: string, prompt: string, schema: any, jsonMode: boolean = true) => {
            const txt = await ReliabilityService.withBackoff(
                () => callGemini({
                    prompt,
                    systemInstruction: instruction,
                    jsonMode,
                    signal,
                    model: 'gemini-3.1-pro-preview' // Spec flow is premium
                }),
                { onRetry: (i, e) => onProgress?.('WAITING', `SpecAgent (Retry ${i}): ${e.message}`) }
            );

            if (!jsonMode) {
                // Parse the structured text response for questions
                const questions: string[] = [];
                const lines = txt.split('\n');
                let capturingQuestions = false;

                for (const line of lines) {
                    if (line.trim().startsWith('## Questions')) {
                        capturingQuestions = true;
                        continue;
                    }
                    if (capturingQuestions && line.trim().startsWith('##')) {
                        capturingQuestions = false;
                    }
                    if (capturingQuestions && line.trim().startsWith('-')) {
                        questions.push(line.trim().substring(1).trim());
                    }
                }

                return {
                    thought_process: "Analysis Complete",
                    questions: questions.length > 0 ? questions : ["Please review the analysis above. If it looks correct, simply type 'Proceed'."],
                    clarified_scope: txt
                };
            }

            return ParserService.parseJson(txt, schema);
        };

        if (nextStage === 'REQUIREMENTS') {
            // Disable JSON mode for Requirements to prevent Injection/Parsing errors
            responseJson = await callSpecAgent(GET_REQUIREMENTS_PROMPT(input), input, RequirementsResponseSchema, false);
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

PROMPT: "${(prompt || "").substring(0, 500)}"

CATEGORÍAS:
- PLANNING: Planes de proyecto, arquitectura, diseño de sistemas, especificaciones, código, scripts, APIs
- WRITING: Texto creativo, emails, documentos, marketing, copywriting
- GENERAL: Preguntas, análisis, consultas que no encajan en las anteriores

REGLAS:
1. Si pide un plan, diagrama, arquitectura o CÓDIGO → PLANNING
2. Si pide redactar texto para humanos → WRITING
3. En caso de duda → GENERAL

Responde SOLO con UNA palabra (PLANNING, WRITING, o GENERAL). Sin explicación.`;

        try {
            const response = await callGemini({
                prompt: CLASSIFIER_PROMPT,
                temperature: 0.1 // Very deterministic
            });

            const category = response.trim().toUpperCase().replace(/[^A-Z]/g, '');

            if (['PLANNING', 'WRITING', 'GENERAL'].includes(category)) {
                logger.info(`[ZeroConfig] Inferred task type: ${category}`);
                return category as 'PLANNING' | 'WRITING' | 'GENERAL';
            }

            logger.warn(`[ZeroConfig] Unknown category "${category}", defaulting to GENERAL`);
            return 'GENERAL';
        } catch (error) {
            logger.error('[ZeroConfig] Inference failed, defaulting to GENERAL', { error });
            return 'GENERAL';
        }
    }
}
