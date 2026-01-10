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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("MISSING_API_KEY: Please add GROQ_API_KEY to your .env file.");
    }

    const model = config.model || "llama-3.3-70b-versatile";

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: config.temperature ?? 0.7,
                max_tokens: config.maxTokens,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`GROQ_API_ERROR: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
        console.error("Groq Call Failed:", error);
        throw new Error(error.message || "Unknown Groq Error");
    }
}
