import { z } from "zod";

/**
 * SCHEMAS for Zod Validation
 * Extracted from geminiService.ts for better modularity.
 */

export const ArchitectResponseSchema = z.object({
    thinking_process: z.string().optional().default("Thinking..."),
    refined_prompt: z.string(),
    changes_made: z.array(z.string()).optional().default([]),
});

export const CriticResponseSchema = z.object({
    safety_pass: z.boolean(),
    clarity_score: z.number().min(0).max(100),
    rubric_checks: z.object({
        has_thinking_protocol: z.boolean().optional().default(false),
        has_artifact_protocol: z.boolean().optional().default(false),
        no_ambiguity: z.boolean(),
    }),
    feedback: z.string(),
});

export const InterviewerResponseSchema = z.object({
    status: z.enum(["READY_TO_OPTIMIZE", "NEEDS_CLARIFICATION"]),
    clarification_question: z.string().nullish(),
});

// V2 SPEC ARCHITECT SCHEMAS
export const RequirementsResponseSchema = z.object({
    thought_process: z.string(),
    questions: z.array(z.string()),
    clarified_scope: z.string().optional(),
});

export const DesignResponseSchema = z.object({
    thought_process: z.string(),
    mermaid_diagram: z.string(),
    data_models: z.string(),
    file_structure: z.string(),
});

export const TasksResponseSchema = z.object({
    thought_process: z.string(),
    tasks: z.array(z.object({
        id: z.number(),
        title: z.string(),
        steps: z.array(z.string())
    }))
});

export const BattleResultSchema = z.object({
    winner: z.enum(['A', 'B', 'Tie']),
    reasoning: z.string(),
    scoreA: z.number().max(100),
    scoreB: z.number().max(100),
    error: z.string().optional(),
});

export const SyntheticDataSchema = z.object({
    dataset_name: z.string(),
    description: z.string(),
    cases: z.array(z.object({
        id: z.string(),
        input: z.string(),
        context: z.string().optional(),
        expected_behavior: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard', 'edge_case'])
    }))
});

export type SyntheticDataResponse = z.infer<typeof SyntheticDataSchema>;

export type ArchitectResponse = z.infer<typeof ArchitectResponseSchema>;
export type CriticResponse = z.infer<typeof CriticResponseSchema>;
export type InterviewerResponse = z.infer<typeof InterviewerResponseSchema>;

export interface OptimizationResult {
    refinedPrompt: string;
    metadata: {
        thinkingProcess: string;
        changesMade: string[];
        criticScore: number;
        rubricChecks: Record<string, boolean>;
    };
    partialSuccess?: boolean;
    // V2 Spec Architect Fields
    specStage?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'COMPLETE';
    artifacts?: {
        requirements?: z.infer<typeof RequirementsResponseSchema>;
        design?: z.infer<typeof DesignResponseSchema>;
        tasks?: z.infer<typeof TasksResponseSchema>;
    };
}
