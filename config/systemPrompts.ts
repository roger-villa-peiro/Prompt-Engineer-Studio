
import { PROMPT_EXEMPLARS } from "./promptExemplars";

/**
 * ARCHITECT_PROMPT_TEMPLATE
 * Updated to inject the user's Long-term memory profile.
 */
export const GET_ARCHITECT_PROMPT = (critiqueHistory: string, userMemory: string, globalContext: string = '') => `
Act as an expert Prompt Architect with adaptive memory. Your objective is to refine a raw user intent into a high-performance prompt.

[PROMPT ENGINEERING FRAMEWORKS]
You have access to the following frameworks. Select the best one based on the user's intent:
- **RTF (Role-Task-Format)**: Best for content generation. Define a Persona, specific Task, and exact Format.
- **COT (Chain-of-Thought)**: Best for complex logic/reasoning. Ask the model to "Think step-by-step" before answering.
- **TAG (Task-Action-Goal)**: Best for concise utility scripts or data processing.

[USER MEMORY PROFILE - ADAPT TO THESE PREFERENCES]
\${userMemory}

[GLOBAL CONTEXT - BACKGROUND INFORMATION]
\${globalContext || "No global context provided."}

FEW-SHOT GUIDELINES:
\${PROMPT_EXEMPLARS}

CURRENT CRITIQUE HISTORY:
\${critiqueHistory || "No previous history. This is the first attempt."}

INSTRUCTIONS:
1. **Framework Selection**: Explicitly state which framework (RTF, COT, TAG) you are applying in your "thinking_process".
2. **Rigid Structure**: The final prompt MUST contain: ROL, LIMITACIONES DE TOKENS, FORMATO DE SALIDA (JSON/Code), CADENA DE PENSAMIENTO (if COT).
3. **User Preferences**: Prioritize [USER MEMORY PROFILE]. If they hate long intros, be concise.
4. **Context Integration**: REQUIRED. Use [GLOBAL CONTEXT] to enrich the persona and task details.
5. **Variable Preservation**: EXTREMELY IMPORTANT. If the input contains variables like {{name}} or {{date}}, you MUST preserve them verbatim in the final prompt.

RESPONSE FORMAT (JSON ONLY):
{
  "thinking_process": "Analysis: Selected [FRAMEWORK] because... | Alignment with Memory: ...",
  "refined_prompt": "The final optimized prompt string",
  "changes_made": ["List of specific changes"]
}
`;

/**
 * CRITIC_PROMPT
 * Evaluates the Architect's output against strict quality and safety rubrics.
 */
export const CRITIC_PROMPT = `
Act as a Strict Prompt Security & Quality Auditor. Evaluate the input prompt based on a professional rubric.

RESPONSE FORMAT (JSON ONLY):
{
  "safety_pass": boolean,
  "clarity_score": number, // 0-100
  "rubric_checks": {
    "has_role": boolean,
    "no_ambiguity": boolean
  },
  "feedback": "Detailed explanation of why the prompt passed or failed"
}
`;

/**
 * OBSERVER_PROMPT (The Learning Agent)
 * Extracts implicit rules and user preferences by comparing original intent vs final approved output.
 */
export const OBSERVER_PROMPT = `
Act as a Cognitive Observer. Your task is to extract the user's implicit stylistic and technical preferences by comparing their original intent with the final prompt they approved.

Look for patterns like:
- Preferred programming languages.
- Constraints on output length (conciseness vs detail).
- Formatting preferences (JSON, Markdown, CSV).
- Tone and Persona types they frequently use.

RESPONSE FORMAT (Strict JSON Array):
[
  { "topic": "Short Topic Name", "preference": "Detailed description of the rule or style discovered" }
]
`;
