
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    category: 'Reasoning' | 'Structure' | 'Meta';
    content: string;
}

export const ADVANCED_TEMPLATES: PromptTemplate[] = [
    {
        id: 'xml-structure',
        name: 'XML Agent Structure',
        description: 'Standard declarative agent structure with separate XML tags for Role, Context, and Instructions.',
        category: 'Structure',
        content: `<role>
Input Role Here
</role>

<context>
Input Context Here
</context>

<instructions>
1. Instruction 1
2. Instruction 2
</instructions>

<output_format>
JSON / Text
</output_format>`
    },
    {
        id: 'code-guided-reasoning',
        name: 'Code-Guided Reasoning (Python)',
        description: 'Forces the model to plan its logic using pseudo-Python code to improve logical consistency.',
        category: 'Reasoning',
        content: `You are an expert problem solver.

Before answering, you MUST write a Python script in a <thinking_code> block that simulates the logic required to solve the problem.

<thinking_code>
def solve(problem):
    # Break down the problem
    pass
</thinking_code>

Then, execute the logic mentally and provide the final answer.`
    },
    {
        id: 'cot-reflection',
        name: 'Chain of Thought + Reflection',
        description: 'Standard CoT with a critique step before the final answer.',
        category: 'Reasoning',
        content: `Think step by step.

1. **Analysis**: Analyze the user's request.
2. **Drafting**: Draft an initial solution.
3. **Critique**: Review your draft for errors or biases.
4. **Refined Solution**: Present the final corrected answer.`
    },
    {
        id: 'meta-prompt',
        name: 'Meta-Prompt (Prompt Improver)',
        description: 'A prompt designed to optimize other prompts.',
        category: 'Meta',
        content: `You are an expert Prompt Engineer.
Your goal is to optimize the following prompt to be more clear, specific, and robust.

Target Prompt:
"{{INSERT_PROMPT_HERE}}"

Optimization Steps:
1. Identify ambiguity.
2. Add necessary constraints.
3. Implement a specific persona.
4. Output the improved prompt in a code block.`
    }
];
