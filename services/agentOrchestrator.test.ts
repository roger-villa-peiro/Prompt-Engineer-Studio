
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator } from './agentOrchestrator';
import { callGemini } from './aiTransport';
import { ReliabilityService } from './reliabilityService';
import { ParserService } from './parserService';

// Mock dependencies
vi.mock('./aiTransport');
vi.mock('./reliabilityService');
vi.mock('./parserService');
vi.mock('../config/aiConfig', () => ({
    AI_CONFIG: {
        MAX_RETRIES: 1, // Minimize retries for testing
        MIN_QUALITY_SCORE: 80,
        GENERATION_CONFIG: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40
        }
    }
}));
vi.mock('../config/systemPrompts', () => ({
    GET_CLARITY_AGENT_PROMPT: () => "CLAITY_PROMPT",
    GET_ARCHITECT_PROMPT: () => "ARCHITECT_PROMPT",
    CRITIC_PROMPT: "CRITIC_PROMPT"
}));
vi.mock('./memoryService', () => ({
    MemoryService: {
        getMemoryString: () => "MEMORY"
    }
}));

describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
        orchestrator = new AgentOrchestrator();
        vi.clearAllMocks();

        // Default: reliability service just executes the function
        (ReliabilityService.withBackoff as any).mockImplementation((fn: () => Promise<any>) => fn());
    });

    describe('assessInputClarity', () => {
        it('should return READY_TO_OPTIMIZE when input is clear', async () => {
            // Mock Gemini response
            const mockResponse = JSON.stringify({ status: "READY_TO_OPTIMIZE" });
            (callGemini as any).mockResolvedValue(mockResponse);

            // Mock Parser response
            (ParserService.parseJson as any).mockReturnValue({ status: "READY_TO_OPTIMIZE" });

            const result = await orchestrator.assessInputClarity("Create a prompt for a chatbot");

            expect(callGemini).toHaveBeenCalled();
            expect(ParserService.parseJson).toHaveBeenCalled();
            expect(result.status).toBe("READY_TO_OPTIMIZE");
        });

        it('should return NEEDS_CLARIFICATION when ambiguity is detected', async () => {
            // Mock Gemini response
            const mockResponse = JSON.stringify({ status: "NEEDS_CLARIFICATION", clarification_question: "What specific topic?" });
            (callGemini as any).mockResolvedValue(mockResponse);

            // Mock Parser response
            (ParserService.parseJson as any).mockReturnValue({ status: "NEEDS_CLARIFICATION", clarification_question: "What specific topic?" });

            const result = await orchestrator.assessInputClarity("Create a prompt");

            expect(result.status).toBe("NEEDS_CLARIFICATION");
            expect(result.clarification_question).toBe("What specific topic?");
        });

        it('should fallback to READY_TO_OPTIMIZE on error', async () => {
            (callGemini as any).mockRejectedValue(new Error("API Error"));

            const result = await orchestrator.assessInputClarity("Create a prompt");

            expect(result.status).toBe("READY_TO_OPTIMIZE");
            // Should warn but not throw
        });
    });

    describe('optimizePromptFlow', () => {
        it('should complete a successful Architect-Critic loop', async () => {
            // Setup Mocks for Architect Step
            (callGemini as any).mockResolvedValueOnce('{"refined_prompt": "Better Prompt"}');
            (ParserService.parseJson as any)
                .mockReturnValueOnce({
                    thinking_process: "Thinking",
                    refined_prompt: "Better Prompt",
                    changes_made: ["Improved clarity"]
                });

            // Setup Mocks for Critic Step
            (callGemini as any).mockResolvedValueOnce('{"safety_pass": true, "clarity_score": 90, "rubric_checks": {"no_ambiguity": true}, "feedback": "Good job"}');
            (ParserService.parseJson as any)
                .mockReturnValueOnce({
                    safety_pass: true,
                    clarity_score: 90,
                    rubric_checks: { no_ambiguity: true },
                    feedback: "Good job"
                });

            const result = await orchestrator.optimizePromptFlow("Original Prompt");

            expect(result.refinedPrompt).toBe("Better Prompt");
            expect(result.metadata.criticScore).toBe(90);
            expect(callGemini).toHaveBeenCalledTimes(2); // Architect + Critic
        });

        it('should retry if Critic score is low', async () => {
            // Attempt 1: Architect
            (callGemini as any).mockResolvedValueOnce('{"refined_prompt": "Bad Prompt"}');
            (ParserService.parseJson as any).mockReturnValueOnce({ refined_prompt: "Bad Prompt" });

            // Attempt 1: Critic (Low Score)
            (callGemini as any).mockResolvedValueOnce('{"clarity_score": 50}');
            (ParserService.parseJson as any).mockReturnValueOnce({ clarity_score: 50, feedback: "Too vague" });

            // Attempt 2: Architect (Refining)
            (callGemini as any).mockResolvedValueOnce('{"refined_prompt": "Good Prompt"}');
            (ParserService.parseJson as any).mockReturnValueOnce({ refined_prompt: "Good Prompt" });

            // Attempt 2: Critic (High Score)
            (callGemini as any).mockResolvedValueOnce('{"clarity_score": 95}');
            (ParserService.parseJson as any).mockReturnValueOnce({ clarity_score: 95, feedback: "Perfect" });

            const result = await orchestrator.optimizePromptFlow("Original Prompt");

            expect(result.refinedPrompt).toBe("Good Prompt");
            expect(result.metadata.criticScore).toBe(95);
            expect(callGemini).toHaveBeenCalledTimes(4); // Arch1, Critic1, Arch2, Critic2
        }, 10000); // Increase timeout
    });
});
