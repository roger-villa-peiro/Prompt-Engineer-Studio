
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

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error: Error) => {
        // Retry on network errors, 5xx, 429
        const msg = error.message.toLowerCase();
        return (
            msg.includes('network') ||
            msg.includes('timeout') ||
            msg.includes('fetch failed') ||
            msg.includes('429') ||
            msg.includes('503') ||
            msg.includes('500') ||
            msg.includes('quota') ||
            msg.includes('rate limit')
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

                if (attempt > (opts.maxRetries || 3) || (opts.shouldRetry && !opts.shouldRetry(error))) {
                    throw error;
                }

                // Calculate delay with jitter: base * 2^attempt + random_jitter
                const exponentialDelay = (opts.baseDelay || 1000) * Math.pow(2, attempt - 1);
                const cappedDelay = Math.min(exponentialDelay, opts.maxDelay || 10000);
                const jitter = Math.random() * 200;
                const delay = cappedDelay + jitter;

                if (opts.onRetry) {
                    opts.onRetry(attempt, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}
