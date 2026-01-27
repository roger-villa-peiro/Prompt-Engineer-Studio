import { logger } from "./loggerService";
import { AI_CONFIG } from "../config/aiConfig";
import { HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Attachment } from "../types";

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

    const parts: any[] = [{ text: prompt }];


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
        const config = {
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
        };

        const controller = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => controller.abort());
        }

        const timeoutMs = timeout || 180000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                contents: [{ role: 'user', parts }],
                config
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proxy Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // Normalize response
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            return data.candidates[0].content.parts.map((p: any) => p.text).join('');
        }

        return JSON.stringify(data);

    } catch (err: any) {
        logger.error("[AiTransport] Error:", err);
        if (err.name === 'AbortError') {
            throw new Error("TIMEOUT: La API tardó demasiado en responder.");
        }
        throw err;
    }
}
