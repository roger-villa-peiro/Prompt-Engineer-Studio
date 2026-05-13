import { logger } from "./loggerService";
import { AI_CONFIG } from "../config/aiConfig";
import { HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Attachment } from "../types";
import { ObservabilityService } from "./observabilityService";
import { applyStrategy, StrategyType } from "./strategiesService";

/**
 * AI Transport Layer
 * Handles the raw communication with the Backend Proxy.
 * Isolated from business logic to prevent circular dependencies.
 */

export async function callGemini({
    prompt,
    systemInstruction,
    jsonMode = false,
    model = AI_CONFIG.MODEL_ID,
    temperature = AI_CONFIG.GENERATION_CONFIG.temperature,
    attachments,
    signal,
    timeout,
    strategy,
    traceId
}: {
    prompt: string;
    systemInstruction?: string;
    jsonMode?: boolean;
    model?: string;
    temperature?: number;
    attachments?: Attachment[];
    signal?: AbortSignal;
    timeout?: number;
    strategy?: StrategyType;
    traceId?: string;
}) {

    // Apply strategy if specified
    let effectivePrompt = prompt;
    let effectiveSystemInstruction = systemInstruction;
    let effectiveTemperature = temperature;

    if (strategy && strategy !== 'NONE') {
        const applied = applyStrategy(prompt, strategy, systemInstruction);
        effectivePrompt = applied.modifiedPrompt;
        effectiveSystemInstruction = applied.modifiedSystemInstruction;
        effectiveTemperature = Math.max(0, Math.min(1, temperature + applied.temperatureAdjust));
        logger.info(`[AiTransport] Strategy applied: ${applied.strategyName}`);
    }

    // Start observability trace
    const trace = ObservabilityService.startTrace({
        name: 'ai-transport-call',
        metadata: { model, strategy: strategy || 'NONE', traceId: traceId || 'unknown' }
    });

    const generation = ObservabilityService.startGeneration(trace, {
        name: `gemini-${model}`,
        model,
        input: { prompt: (effectivePrompt || "").substring(0, 500), hasAttachments: !!(attachments?.length) },
        modelParameters: { temperature: effectiveTemperature, jsonMode }
    });

    const startTime = Date.now();
    const parts: any[] = [{ text: effectivePrompt }];


    if (attachments && attachments.length > 0) {
        // Lazily convert any File-based attachments to Base64
        const processedAttachments = await Promise.all(attachments.map(async (att) => {
            if (att.data) return att; // Already base64
            if (att.file) {
                // Convert File to Base64
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = reader.result as string;
                        // Handle potential null or array buffer (though readAsDataURL returns string)
                        if (typeof res === 'string') {
                            resolve(res.split(',')[1]);
                        } else {
                            reject(new Error("Failed to read file as string"));
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(att.file!);
                });
                return { ...att, data: base64 };
            }
            return att;
        }));

        processedAttachments.forEach(att => {
            if (att.data) {
                parts.push({
                    inlineData: {
                        mimeType: att.type,
                        data: att.data
                    }
                });
            }
        });
    }
    try {
        const generationConfig = {
            responseMimeType: jsonMode ? "application/json" : "text/plain",
            temperature: effectiveTemperature,
            topP: AI_CONFIG.GENERATION_CONFIG.topP,
            topK: AI_CONFIG.GENERATION_CONFIG.topK,
        };

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        // v4.0 FIX: Hardened Transport - System Instruction is MANDATORY
        if (!effectiveSystemInstruction) {
            throw new Error("Hardened Transport Error: systemInstruction is MISSING. Refusing to call Model without safety protocols.");
        }

        const systemInstructionObj = { parts: [{ text: effectiveSystemInstruction }] };

        const controller = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => controller.abort());
        }

        const timeoutMs = timeout || 180000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const customGeminiKey = localStorage.getItem('antigravity_gemini_key');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        if (customGeminiKey) {
            headers['X-Gemini-Api-Key'] = customGeminiKey;
        }

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model,
                contents: [{ role: 'user', parts }],
                systemInstruction: systemInstructionObj,
                generationConfig,
                safetySettings
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            let parsedErrorStr = errorText;

            try {
                // Try to parse the error as JSON for better logging
                const jsonError = JSON.parse(errorText);
                if (jsonError.error) {
                    const funcErr = jsonError.error; // { code, message, status }
                    parsedErrorStr = `${funcErr.status || 'Error'} (${funcErr.code}): ${funcErr.message}`;

                    // Specific check for Overloaded/503 to ensure ReliabilityService catches it
                    if (funcErr.code === 503 || funcErr.status === 'UNAVAILABLE') {
                        throw new Error(`GenAI Overloaded (503): ${funcErr.message}`);
                    }
                }
            } catch (e) {
                // Ignore JSON parse error, use raw text
            }

            throw new Error(`Proxy Error: ${response.status} ${response.statusText} - ${parsedErrorStr}`);
        }

        const data = await response.json();

        // CHECK FOR UPSTREAM API ERRORS
        if (data.error) {
            throw new Error(`GenAI API Error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        // Normalize response
        let responseText: string;
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            responseText = data.candidates[0].content.parts.map((p: any) => p.text).join('');
        } else {
            // If no candidates and no explicit error, this is still a failure state for a generation request
            throw new Error(`GenAI Empty Response: No candidates returned. Raw: ${JSON.stringify(data).substring(0, 200)}`);
        }

        // End observability generation
        const latencyMs = Date.now() - startTime;
        ObservabilityService.endGeneration(generation, {
            output: responseText.substring(0, 500),
            latencyMs,
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                totalTokens: data.usageMetadata.totalTokenCount
            } : undefined
        });

        return responseText;

    } catch (err: any) {
        logger.error("[AiTransport] Error:", err);

        // End generation with error
        if (generation) {
            ObservabilityService.endGeneration(generation, {
                output: `ERROR: ${err.message}`,
                latencyMs: Date.now() - startTime
            });
        }

        if (err.name === 'AbortError') {
            throw new Error("TIMEOUT: La API tardó demasiado en responder.");
        }
        throw err;
    }
}
