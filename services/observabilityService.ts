/**
 * Observability Service - Langfuse Integration
 * Provides tracing and monitoring for all LLM calls.
 * Based on the langfuse skill from vibeship-spawner-skills.
 */

import { Langfuse, LangfuseTraceClient, LangfuseGenerationClient } from 'langfuse';
import { logger } from './loggerService';

// Environment configuration (Support Vite/Browser and Node)
const getEnv = (key: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[key] || '';
    }
    // Fallback for Node/Testing if needed
    try {
        return process.env[key] || '';
    } catch {
        return '';
    }
};

const LANGFUSE_PUBLIC_KEY = getEnv('VITE_LANGFUSE_PUBLIC_KEY');
const LANGFUSE_SECRET_KEY = getEnv('LANGFUSE_SECRET_KEY'); // Only available in Node/Server
const LANGFUSE_HOST = getEnv('VITE_LANGFUSE_HOST') || 'https://cloud.langfuse.com';

// Singleton instance
let langfuseClient: Langfuse | null = null;

/**
 * Initialize Langfuse client if keys are available.
 */
function getClient(): Langfuse | null {
    if (langfuseClient) return langfuseClient;

    if (!LANGFUSE_PUBLIC_KEY) {
        logger.warn('[Observability] Langfuse public key not configured. Tracing disabled.');
        return null;
    }

    try {
        const config: any = {
            publicKey: LANGFUSE_PUBLIC_KEY,
            baseUrl: LANGFUSE_HOST
        };

        // Only add secret key if available (Node.js environment)
        if (LANGFUSE_SECRET_KEY) {
            config.secretKey = LANGFUSE_SECRET_KEY;
        }

        langfuseClient = new Langfuse(config);

        logger.info('[Observability] Langfuse client initialized.');
        return langfuseClient;
    } catch (error) {
        logger.error('[Observability] Failed to initialize Langfuse:', error);
        return null;
    }
}

export interface TraceOptions {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
}

export interface GenerationOptions {
    name: string;
    model: string;
    input: unknown;
    modelParameters?: Record<string, string | number | boolean | string[] | null>;
    metadata?: Record<string, unknown>;
}

export interface GenerationResult {
    output: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    latencyMs?: number;
}

export const ObservabilityService = {
    /**
     * Create a new trace for a user request.
     */
    startTrace(options: TraceOptions): LangfuseTraceClient | null {
        const client = getClient();
        if (!client) return null;

        try {
            return client.trace({
                name: options.name,
                userId: options.userId,
                sessionId: options.sessionId,
                metadata: options.metadata,
                tags: options.tags
            });
        } catch (error) {
            logger.error('[Observability] Failed to start trace:', error);
            return null;
        }
    },

    /**
     * Start a generation span within a trace.
     */
    startGeneration(trace: LangfuseTraceClient | null, options: GenerationOptions): LangfuseGenerationClient | null {
        if (!trace) return null;

        try {
            return trace.generation({
                name: options.name,
                model: options.model,
                input: options.input,
                modelParameters: options.modelParameters,
                metadata: options.metadata
            });
        } catch (error) {
            logger.error('[Observability] Failed to start generation:', error);
            return null;
        }
    },

    /**
     * End a generation span with the output and usage.
     */
    endGeneration(generation: LangfuseGenerationClient | null, result: GenerationResult): void {
        if (!generation) return;

        try {
            generation.end({
                output: result.output,
                usage: result.usage ? {
                    input: result.usage.promptTokens,
                    output: result.usage.completionTokens,
                    total: result.usage.totalTokens
                } : undefined
            });
        } catch (error) {
            logger.error('[Observability] Failed to end generation:', error);
        }
    },

    /**
     * Add a score to a trace (e.g., user feedback, quality score).
     */
    score(trace: LangfuseTraceClient | null, name: string, value: number, comment?: string): void {
        if (!trace) return;

        try {
            trace.score({
                name,
                value,
                comment
            });
        } catch (error) {
            logger.error('[Observability] Failed to add score:', error);
        }
    },

    /**
     * Flush all pending events to Langfuse.
     * CRITICAL: Call this before serverless function exits.
     */
    async flush(): Promise<void> {
        const client = getClient();
        if (!client) return;

        try {
            await client.flushAsync();
            logger.info('[Observability] Traces flushed successfully.');
        } catch (error) {
            logger.error('[Observability] Failed to flush traces:', error);
        }
    },

    /**
     * Get the raw client for advanced use cases.
     */
    getClient
};
