import { z } from "zod";

/**
 * SCHEMAS for Zod Validation
 * 
 * REF: SKILL error-handling-patterns
 * All schemas are designed for RESILIENCE against LLM output variations:
 * - Optional fields have defaults
 * - Numeric fields coerce from strings  
 * - Boolean fields coerce from strings/numbers
 * - .passthrough() allows extra fields without failing
 */

// Helper: Coerce string "true"/"false" to boolean
const coerceBoolean = z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    if (typeof val === 'number') return val !== 0;
    return val;
}, z.boolean());

// Helper: Coerce string numbers to actual numbers
const coerceNumber = z.preprocess((val) => {
    if (typeof val === 'string') return parseFloat(val) || 0;
    return val;
}, z.number());

// New Schemas for Self-Refine Data
export const RagTriadScoreSchema = z.object({
    contextRelevancy: coerceNumber,
    groundedness: coerceNumber,
    answerRelevancy: coerceNumber,
});

export const SecurityEventSchema = z.object({
    type: z.enum(['injection_detected', 'echo_detected', 'validation_failed', 'schema_validation_failed']),
    timestamp: coerceNumber,
    details: z.string(),
});

export const RefineIterationSchema = z.object({
    draft: z.string(),
    feedback: z.string(),
    score: coerceNumber,
    timestamp: coerceNumber,
    ragTriad: RagTriadScoreSchema.optional().nullable(),
});

export const ArchitectResponseSchema = z.preprocess(
    (val: any) => {
        if (val && typeof val === 'object' && !val.refined_prompt && val.refinedPrompt) {
            val.refined_prompt = val.refinedPrompt;
        }
        if (val && typeof val === 'object' && !val.changes_made && val.changesMade) {
            val.changes_made = val.changesMade;
        }
        if (val && typeof val === 'object' && !val.thinking_process && val.thinkingProcess) {
            val.thinking_process = val.thinkingProcess;
        }
        return val;
    },
    z.object({
        thinking_process: z.preprocess(
            (val) => (typeof val === 'string' ? val : String(val ?? 'Thinking...')),
            z.string()
        ).optional().default("Thinking..."),
        refined_prompt: z.string(),
        changes_made: z.preprocess(
            (val) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') return [val];
                return [];
            },
            z.array(z.string())
        ).optional().default([]),
    }).passthrough()
);

export const CriticResponseSchema = z.object({
    safety_pass: coerceBoolean.optional().default(true),
    clarity_score: coerceNumber.pipe(z.number().min(0).max(100)),
    dimension_scores: z.object({
        structure: coerceNumber.optional().default(0),
        persona: coerceNumber.optional().default(0),
        reasoning: coerceNumber.optional().default(0),
        constraints: coerceNumber.optional().default(0),
        specificity: coerceNumber.optional().default(0),
        output_format: coerceNumber.optional().default(0),
    }).passthrough().optional(),
    rubric_checks: z.object({
        has_thinking_protocol: coerceBoolean.optional().default(false),
        has_artifact_protocol: coerceBoolean.optional().default(false),
        no_ambiguity: coerceBoolean.optional().default(true),
    }).passthrough().optional().default({
        has_thinking_protocol: false,
        has_artifact_protocol: false,
        no_ambiguity: true,
    }),
    // Self-RAG Reflection Tokens (from 'info IA definitiva' research)
    reflection_tokens: z.object({
        is_relevant: coerceBoolean.optional().default(true),   // Does the prompt address user intent?
        is_supported: coerceBoolean.optional().default(true),  // Are instructions grounded in context?
        is_useful: coerceBoolean.optional().default(true),     // Does it solve the user's real problem?
        relevance_reasoning: z.string().optional().default(""), // Brief explanation of relevance assessment
    }).passthrough().optional().default({
        is_relevant: true,
        is_supported: true,
        is_useful: true,
        relevance_reasoning: "",
    }),
    feedback: z.string().optional().default("No feedback provided."),
}).passthrough();

export const InterviewerResponseSchema = z.object({
    status: z.enum(["READY_TO_OPTIMIZE", "NEEDS_CLARIFICATION"]),
    clarification_question: z.string().nullish(),
}).passthrough();

// V2 SPEC ARCHITECT SCHEMAS
export const RequirementsResponseSchema = z.object({
    thought_process: z.string().optional().default("Processing..."),
    questions: z.array(z.string()).optional().default([]),
    clarified_scope: z.string().optional(),
}).passthrough();

export const DesignResponseSchema = z.object({
    thought_process: z.string().optional().default("Processing..."),
    mermaid_diagram: z.string().optional().default(""),
    data_models: z.string().optional().default(""),
    file_structure: z.string().optional().default(""),
}).passthrough();

export const TasksResponseSchema = z.object({
    thought_process: z.string().optional().default("Processing..."),
    tasks: z.array(z.object({
        id: coerceNumber.pipe(z.number()),
        title: z.string(),
        steps: z.array(z.string()).optional().default([])
    })).optional().default([])
}).passthrough();

export const BattleResultSchema = z.object({
    winner: z.enum(['A', 'B', 'Tie']),
    reasoning: z.string().optional().default(""),
    scoreA: coerceNumber.pipe(z.number().max(100)),
    scoreB: coerceNumber.pipe(z.number().max(100)),
    error: z.string().optional(),
}).passthrough();

export const SyntheticDataSchema = z.object({
    dataset_name: z.string().optional().default("Generated Dataset"),
    description: z.string().optional().default(""),
    cases: z.array(z.object({
        id: z.string(),
        input: z.string(),
        context: z.string().optional(),
        expected_behavior: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard', 'edge_case']).optional().default('medium')
    }))
}).passthrough();

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
        // Phase 1 additions
        reflectionTokens?: {
            is_relevant: boolean;
            is_supported: boolean;
            is_useful: boolean;
            relevance_reasoning?: string;
        };
        selfRefineIterations?: number;
        selfRefineConverged?: boolean;
        improvementDelta?: number;
        // Detailed Self-Refine Data (New)
        selfRefineHistory?: z.infer<typeof RefineIterationSchema>[];
        securityEvents?: z.infer<typeof SecurityEventSchema>[];
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
