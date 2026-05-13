
/**
 * REF: SKILL error-handling-patterns
 * Reliability Service
 * 
 * Provides robust error handling mechanisms including:
 * - Exponential Backoff
 * - Retry Logic with Jitter
 * - Error Classification
 */

interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
    shouldRetry?: (error: Error) => boolean;
}
import { AI_CONFIG } from '../config/aiConfig';

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: AI_CONFIG.MAX_RETRIES,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error: Error) => {
        // Retry on network errors, 5xx, 429, and parser errors (non-deterministic model output)
        const msg = error.message.toLowerCase();
        return (
            msg.includes('network') ||
            msg.includes('timeout') ||
            msg.includes('fetch failed') ||
            msg.includes('429') ||
            msg.includes('503') ||
            msg.includes('500') ||
            msg.includes('quota') ||
            msg.includes('rate limit') ||
            msg.includes('syntax_error') ||
            msg.includes('parser_error')
        );
    }
};

export class ReliabilityService {
    /**
     * Executes a function with exponential backoff retries.
     */
    static async withBackoff<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        let attempt = 0;

        while (true) {
            try {
                return await operation();
            } catch (error: any) {
                attempt++;

                // Smart Backoff: Detect overload errors (503, 429)
                const isOverload = error.message.includes('503') ||
                    error.message.includes('429') ||
                    error.message.includes('Overloaded') ||
                    error.message.includes('UNAVAILABLE');

                // If overloaded, use a more patient strategy
                const effectiveMaxRetries = isOverload ? (opts.maxRetries || 3) + 2 : (opts.maxRetries || 3);

                if (attempt > effectiveMaxRetries || (opts.shouldRetry && !opts.shouldRetry(error))) {
                    throw error;
                }

                // Calculate delay with jitter
                // Normal: base * 2^(attempt-1)
                // Overload: start higher (3000ms) and grow slower but longer cap
                let baseDelay = opts.baseDelay || 1000;
                if (isOverload) baseDelay = Math.max(baseDelay, 3000);

                const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
                const cappedDelay = Math.min(exponentialDelay, opts.maxDelay || (isOverload ? 20000 : 10000));

                // Add jitter (randomness) to avoid thundering herd
                const jitter = Math.random() * (isOverload ? 1000 : 200);
                const delay = cappedDelay + jitter;

                if (opts.onRetry) {
                    opts.onRetry(attempt, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}
