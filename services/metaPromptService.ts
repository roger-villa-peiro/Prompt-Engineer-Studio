import { callGemini, safeJsonParse } from "./geminiService";
import { logger } from "./loggerService";
import { z } from "zod";

/**
 * META-PROMPTING SERVICE (Conductor-Expert Architecture)
 * Decomposes complex tasks into sub-tasks, assigns to experts, and aggregates results.
 */

export interface SubTask {
    id: string;
    description: string;
    expertPersona: string; // e.g. "Data Scientist", "Creative Writer"
    dependencies?: string[]; // IDs of tasks that must finish first (Graph logic)
}

const SubTaskSchema = z.array(z.object({
    id: z.string(),
    description: z.string(),
    expertPersona: z.string(),
    dependencies: z.array(z.string()).optional()
}));

export interface ExpertOutput {
    taskId: string;
    output: string;
    metrics?: any;
}

// 1. Decompose Task (Conductor)
export async function decomposeTask(input: string, context: string = ""): Promise<SubTask[]> {
    const systemPrompt = `You are a Chief AI Architect (Conductor).
    Your goal is to assert whether the user request is COMPLEX enough to require decomposition.
    If yes, break it down into 2-5 distinct sub-tasks handled by specialized Expert Personas.
    If no (simple request), return an empty array [].

    CRITERIA FOR DECOMPOSITION:
    - Multiple domains (e.g. "Write a SQL query AND a Python script to graph it AND a blog post")
    - Step-by-step logic chains (e.g. "Research X, then Plan Y, then Implement Z")
    - Large scope (e.g. "Build a full marketing strategy")

    OUTPUT FORMAT (JSON Array of objects):
    [
        {
            "id": "task_1",
            "description": "Extract key financial metrics from context",
            "expertPersona": "Senior Financial Analyst"
        },
        ...
    ]
    `;

    const userPrompt = `
    USER REQUEST:
    ${input}
    
    CONTEXT:
    ${context}
    
    Decompose if necessary.
    `;

    try {
        const response = await callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: "gemini-3.1-pro-preview", // Smart model for planning
            temperature: 0.2,
            jsonMode: true
        });

        const tasks = safeJsonParse(response, SubTaskSchema);
        return Array.isArray(tasks) ? tasks : [];
    } catch (e) {
        logger.error("Meta-Prompting Decomposition Failed", e);
        return [];
    }
}

// 2. Execute Sub-Task (Expert)
export async function routeToExpert(subTask: SubTask, originalInput: string, context: string): Promise<ExpertOutput> {
    const systemPrompt = `You are a world-class ${subTask.expertPersona}.
    Your sole task is to execute the instructions provided by the Conductor, ignoring all else.
    
    Context provided is for reference only.
    Focus exclusively on your sub-task.
    `;

    const userPrompt = `
    OVERALL GOAL: ${originalInput}
    
    YOUR SUB-TASK:
    ${subTask.description}
    
    CONTEXT:
    ${context}
    
    Execute your sub-task now.
    `;

    try {
        const response = await callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: "gemini-3.1-pro-preview", // Experts should also be smart
            temperature: 0.4
        });

        return {
            taskId: subTask.id,
            output: response
        };
    } catch (e) {
        return {
            taskId: subTask.id,
            output: `[Error executing sub-task ${subTask.id}]`
        };
    }
}

// 3. Synthesize Results (Conductor)
export async function synthesize(originalInput: string, expertOutputs: ExpertOutput[]): Promise<string> {
    const systemPrompt = `You are the Chief AI Architect (Conductor).
    You have received outputs from your team of Experts.
    Your goal is to aggregate them into a Final, Coherent Response that answers the original user request.
    
    - Smooth out transitions between sections.
    - Ensure consistent tone.
    - Remove redundancies.
    - Do NOT mention "Expert 1 said..." -> Just present the result.
    `;

    const outputsText = expertOutputs.map(o => `[Task ${o.taskId} Result]:\n${o.output}\n---`).join("\n");

    const userPrompt = `
    ORIGINAL REQUEST: ${originalInput}
    
    EXPERT OUTPUTS:
    ${outputsText}
    
    Synthesize the final response.
    `;

    try {
        const response = await callGemini({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            model: "gemini-3.1-pro-preview",
            temperature: 0.3
        });
        return response;
    } catch (e) {
        return expertOutputs.map(o => o.output).join("\n\n");
    }
}

/**
 * Orchestrator for Meta-Prompting
 */
export async function runMetaPromptingFlow(input: string, context: string): Promise<string | null> {
    // 1. Decompose
    const subTasks = await decomposeTask(input, context);

    if (subTasks.length === 0) {
        return null; // Delegate back to standard flow
    }

    logger.info(`[MetaPrompt] Decomposed into ${subTasks.length} tasks.`);

    // 2. Execute in Parallel (assuming no dependencies for MVP)
    const results = await Promise.all(
        subTasks.map(task => routeToExpert(task, input, context))
    );

    // 3. Synthesize
    const finalOutput = await synthesize(input, results);

    return finalOutput;
}
