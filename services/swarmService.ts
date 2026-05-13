/**
 * AGENT SWARM SERVICE
 * 
 * Implements a multi-agent system for complex code generation tasks.
 * Defines roles (Manager, Architect, Engineer, QA) and orchestrates their interaction
 * to produce high-quality, multi-file code solutions.
 */

import { callGemini } from "./aiTransport";
import { ReliabilityService } from "./reliabilityService";
import { ParserService } from "./parserService";
import { z } from "zod";
import { logger } from "./loggerService";

// ===================================
// TYPES & ROLES
// ===================================

export type AgentRole = 'MANAGER' | 'ARCHITECT' | 'ENGINEER' | 'QA';

export interface AgentMessage {
    role: AgentRole;
    content: string;
    timestamp: number;
    files?: Record<string, string>; // Files changed/created
}

export interface SwarmState {
    id: string;
    objective: string;
    messages: AgentMessage[];
    files: Record<string, string>; // Virtual file system
    status: 'PLANNING' | 'CODING' | 'REVIEWING' | 'DONE' | 'FAILED';
    plan: string[]; // Step-by-step plan
}

// ===================================
// SCHEMAS
// ===================================

const PlanSchema = z.object({
    steps: z.array(z.string()),
    reasoning: z.string()
});

const CodeGenSchema = z.object({
    files: z.record(z.string()), // filename -> content
    explanation: z.string()
});

const ReviewSchema = z.object({
    approved: z.boolean(),
    feedback: z.string(),
    issues: z.array(z.string())
});

// ===================================
// AGENT PROMPTS
// ===================================

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
    MANAGER: `You are the SWARM MANAGER. Your goal is to oversee the project, create plans, and coordinate the team.
    - BREAK DOWN the user's request into clear, actionable steps.
    - ASSIGN tasks to the Architect and Engineer.
    - ENSURE the final output meets the user's requirements.`,

    ARCHITECT: `You are the SOFTWARE ARCHITECT. Your goal is to design the system structure.
    - DEFINE the file structure and component hierarchy.
    - CHOOSE the best technologies and patterns.
    - WRITE the technical specification.`,

    ENGINEER: `You are the SENIOR SOFTWARE ENGINEER. Your goal is to write clean, efficient, and bug-free code.
    - IMPLEMENT the features described by the Architect.
    - FOLLOW best practices and coding standards.
    - RETURN the full code for all necessary files.`,

    QA: `You are the QA LEAD. Your goal is to review the code and ensure quality.
    - REVIEW the code for bugs, security issues, and performance bottlenecks.
    - PROVIDE constructive feedback.
    - APPROVE only if the code is production-ready.`
};

// ===================================
// SERVICE IMPLEMENTATION
// ===================================

export class SwarmService {
    private state: SwarmState;
    private onUpdate?: (state: SwarmState) => void;

    constructor(objective: string, initialFiles: Record<string, string> = {}) {
        this.state = {
            id: crypto.randomUUID(),
            objective,
            messages: [],
            files: initialFiles,
            status: 'PLANNING',
            plan: []
        };
    }

    /**
     * Run the full Swarm lifecycle
     */
    async run(onUpdate?: (state: SwarmState) => void): Promise<SwarmState> {
        this.onUpdate = onUpdate;
        logger.info(`[Swarm] Starting swarm for objective: ${this.state.objective}`);

        // 1. PLANNING PHASE (Manager)
        await this.runPlanningPhase();

        // 2. CODING PHASE (Architect -> Engineer)
        await this.runCodingPhase();

        // 3. REVIEW PHASE (QA)
        await this.runReviewPhase();

        return this.state;
    }

    private emitUpdate() {
        if (this.onUpdate) {
            this.onUpdate({ ...this.state });
        }
    }

    private async runPlanningPhase() {
        this.state.status = 'PLANNING';
        this.emitUpdate();

        const prompt = `OBJECTIVE: ${this.state.objective}\n\nCreate a step-by-step execution plan.`;

        const response = await this.callAgent('MANAGER', prompt, PlanSchema);
        this.state.plan = response.steps;
        this.addMessage('MANAGER', `Plan created: ${response.reasoning}`);
    }

    private async runCodingPhase() {
        this.state.status = 'CODING';
        this.emitUpdate();

        const prompt = `OBJECTIVE: ${this.state.objective}\n\nPLAN:\n${this.state.plan.join('\n')}\n\nEXISTING FILES:\n${JSON.stringify(Object.keys(this.state.files))}\n\nGenerate the code for the necessary files.`;

        const response = await this.callAgent('ENGINEER', prompt, CodeGenSchema);

        // Merge new files
        this.state.files = { ...this.state.files, ...response.files };
        this.addMessage('ENGINEER', `Generated code for ${Object.keys(response.files).length} files. \n${response.explanation}`, response.files);
    }

    private async runReviewPhase() {
        this.state.status = 'REVIEWING';
        this.emitUpdate();

        const prompt = `OBJECTIVE: ${this.state.objective}\n\nFILES:\n${JSON.stringify(this.state.files, null, 2)}\n\nReview the code. Is it correct and complete?`;

        const response = await this.callAgent('QA', prompt, ReviewSchema);

        if (response.approved) {
            this.state.status = 'DONE';
            this.addMessage('QA', `Code approved! ${response.feedback}`);
        } else {
            this.state.status = 'FAILED';
            this.addMessage('QA', `Code rejected. Issues:\n- ${response.issues.join('\n- ')}\nFeedback: ${response.feedback}`);

            // Auto-fix attempt (simple loop)
            await this.fixCode(response.issues);
        }
        this.emitUpdate();
    }

    private async fixCode(issues: string[]) {
        this.addMessage('MANAGER', 'QA rejected. Requesting fixes from Engineer.');

        const prompt = `The QA Lead rejected the previous code with these issues:\n- ${issues.join('\n- ')}\n\nPlease fix the code and return the updated files.`;
        const response = await this.callAgent('ENGINEER', prompt, CodeGenSchema);

        this.state.files = { ...this.state.files, ...response.files };
        this.addMessage('ENGINEER', `Applied fixes. ${response.explanation}`, response.files);

        this.state.status = 'DONE';
    }

    // Helper: Call LLM with Agent Persona
    private async callAgent<T>(role: AgentRole, userPrompt: string, schema: z.ZodType<T>): Promise<T> {
        const systemPrompt = SYSTEM_PROMPTS[role];

        return await ReliabilityService.withBackoff(() => callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            jsonMode: true,
            temperature: role === 'ENGINEER' ? 0.2 : 0.7
        }).then(res => ParserService.parseJson(res, schema)));
    }

    private addMessage(role: AgentRole, content: string, files?: Record<string, string>) {
        this.state.messages.push({
            role,
            content,
            timestamp: Date.now(),
            files
        });
        this.emitUpdate();
        logger.info(`[Swarm] ${role}: ${content.substring(0, 100)}...`);
    }
}
