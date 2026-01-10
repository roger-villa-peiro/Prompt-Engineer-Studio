import { callGemini } from "./geminiService";

export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'groq';

export interface AIResponse {
    text: string;
    provider: ModelProvider;
    model: string;
    latency: number;
}

export const AIService = {
    async generate(
        prompt: string,
        provider: ModelProvider,
        modelId: string,
        systemInstruction?: string
    ): Promise<AIResponse> {
        const start = performance.now();
        let text = "";

        try {
            if (provider === 'gemini') {
                text = await callGemini({ prompt, systemInstruction, model: modelId });
            }
            else if (provider === 'openai') {
                // Placeholder for future OpenAI integration
                await new Promise(r => setTimeout(r, 1500)); // Simulate network
                text = `[MOCK OPENAI OUTPUT]\nThis is a simulated response from ${modelId}.\n\nTo enable real OpenAI calls, please add OPENAI_API_KEY to your .env file and uncomment the integration code.`;
            }
            else if (provider === 'anthropic') {
                // Placeholder for future Claude integration
                await new Promise(r => setTimeout(r, 2000));
                text = `[MOCK CLAUDE OUTPUT]\nThis is a simulated response from ${modelId}.\n\nTo enable real Anthropic calls, please configure the adapter.`;
            }
            else if (provider === 'groq') {
                const { callGroq } = await import("./groqService");
                text = await callGroq(prompt, { model: modelId });
            }
        } catch (err: any) {
            text = `Error (${provider}): ${err.message}`;
        }

        const end = performance.now();
        return {
            text,
            provider,
            model: modelId,
            latency: Math.round(end - start)
        };
    }
};
