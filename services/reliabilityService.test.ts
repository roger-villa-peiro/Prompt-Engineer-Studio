
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReliabilityService } from './reliabilityService';

describe('ReliabilityService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Zero jitter for predictable tests
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should succeed immediately if operation works', async () => {
        const op = vi.fn().mockResolvedValue('success');
        const result = await ReliabilityService.withBackoff(op);

        expect(result).toBe('success');
        expect(op).toHaveBeenCalledTimes(1);
    });

    it('should retry on standard error (exponential backoff)', async () => {
        // Fail twice, succeed third time
        const op = vi.fn()
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValue('success');

        const promise = ReliabilityService.withBackoff(op, { baseDelay: 100 });

        // Advance timers to trigger retries
        // Attempt 1 delay: 100 * 2^0 = 100ms
        await vi.advanceTimersByTimeAsync(100);
        // Attempt 2 delay: 100 * 2^1 = 200ms
        await vi.advanceTimersByTimeAsync(200);

        const result = await promise;
        expect(result).toBe('success');
        expect(op).toHaveBeenCalledTimes(3);
    });

    it('should apply Smart Backoff (longer delay) for 503 errors', async () => {
        const op = vi.fn()
            .mockRejectedValueOnce(new Error('GenAI Overloaded (503): Service Unavailable'))
            .mockResolvedValue('success');

        const promise = ReliabilityService.withBackoff(op, { baseDelay: 100 }); // Base 100 ignored for 503

        // Default base for overload is 3000ms.
        // Attempt 1 delay: 3000 * 2^0 = 3000ms

        // Check that 100ms is NOT enough
        await vi.advanceTimersByTimeAsync(100);
        expect(op).toHaveBeenCalledTimes(1); // Still waiting

        // Advance to 3000ms
        await vi.advanceTimersByTimeAsync(3000);

        const result = await promise;
        expect(result).toBe('success');
        expect(op).toHaveBeenCalledTimes(2);
    });

    it('should increase max retries for 503 errors', async () => {
        // Default maxRetries is 3. For 503, it should be 3 + 2 = 5.
        // We will fail 5 times and succeed on the 6th.
        const error503 = new Error('503 Service Unavailable');
        const op = vi.fn();

        for (let i = 0; i < 5; i++) op.mockRejectedValueOnce(error503);
        op.mockResolvedValue('success');

        // Use promise to catch result
        const promise = ReliabilityService.withBackoff(op, { maxRetries: 3 });

        // Fast-forward all delays
        // Delays: 3000, 6000, 12000, 20000 (cap), 20000 (cap)
        await vi.runAllTimersAsync();

        const result = await promise;
        expect(result).toBe('success');
        expect(op).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
    });

    it('should fail if max retries exceeded (standard error)', async () => {
        const op = vi.fn().mockRejectedValue(new Error('Network Error'));

        const promise = ReliabilityService.withBackoff(op, { maxRetries: 2 });

        // Attach handler BEFORE running timers to avoid unhandled rejection
        const expectPromise = expect(promise).rejects.toThrow('Network Error');

        // Fast-forward
        await vi.runAllTimersAsync();

        await expectPromise;
        expect(op).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
});
