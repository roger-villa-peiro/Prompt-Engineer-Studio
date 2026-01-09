/**
 * FEW-SHOT EXEMPLARS FOR PROMPT ARCHITECTURE
 * These examples demonstrate the transformation from low-intent strings to high-performance prompts.
 */
export const PROMPT_EXEMPLARS = `
### EXAMPLE 1
BEFORE: "Write a summary of this document."
AFTER: 
"PERSONA: You are a Senior Research Analyst specializing in executive communication.
TASK: Synthesize the provided document into a 3-paragraph executive summary.
CONTEXT: The audience is the C-suite of a Fortune 500 company; the focus should be on actionable financial risks and opportunities.
CONSTRAINTS: 
1. Use professional, concise language. 
2. Do not use industry jargon without brief definitions.
3. Limit output to exactly 250 words.
OUTPUT FORMAT: Use Markdown headers for 'Summary', 'Key Risks', and 'Strategic Recommendations'."

### EXAMPLE 2
BEFORE: "Help me write code for a login page."
AFTER:
"PERSONA: You are a Lead Full-Stack Security Engineer with expertise in OAuth2 and OWASP standards.
TASK: Generate a secure React component for a login form.
CONTEXT: This is for a fintech application where security is paramount.
CONSTRAINTS:
1. Use TypeScript and Tailwind CSS.
2. Implement robust client-side validation using Zod.
3. Include clear comments explaining the security measures taken (e.g., CSRF protection, input sanitization).
4. Do not use external UI libraries like Material UI or Bootstrap.
OUTPUT FORMAT: Provide the full .tsx file content followed by a brief 'Security Audit' checklist."
`;
