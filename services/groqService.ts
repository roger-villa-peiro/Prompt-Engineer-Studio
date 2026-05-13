import { logger } from "./loggerService";

export interface GroqConfig {

    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

export async function callGroq(
    prompt: string,
    config: Partial<GroqConfig> = {},
    systemInstruction?: string
): Promise<string> {
    const model = config.model || "llama-3.3-70b-versatile";

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    try {
        const customGroqKey = localStorage.getItem('antigravity_groq_key');
        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };
        
        if (customGroqKey) {
            headers['X-Groq-Api-Key'] = customGroqKey;
        }

        const response = await fetch("/api/groq", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: config.temperature ?? 0.7,
                maxTokens: config.maxTokens,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `GROQ_API_ERROR: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
        logger.error("Groq Call Failed:", error);
        throw new Error(error.message || "Unknown Groq Error");
    }
}
