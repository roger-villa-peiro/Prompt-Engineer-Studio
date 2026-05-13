
import { AgentSignature } from '../types';

export const compileSignatureToPrompt = (sig: AgentSignature): string => {
    let prompt = `<role>\n${sig.name}\n${sig.description}\n</role>\n\n`;

    prompt += "<inputs>\n";
    if (sig.inputs.length === 0) {
        prompt += "<!-- No specific structured inputs defined -->\n";
    } else {
        sig.inputs.forEach((f: any) => {
            prompt += `<field name="${f.name}" type="${f.type}" required="${f.required}">\n  ${f.description || 'No description'}\n</field>\n`;
        });
    }
    prompt += "</inputs>\n\n";

    if (sig.steps.length > 0) {
        prompt += "<logic_process>\n";
        sig.steps.forEach((s: any, i: number) => {
            const typeLabel = s.type === 'CoT' ? 'Chain of Thought' : s.type === 'ReAct' ? 'Reason+Act' : 'Reflexion';
            prompt += `  <step index="${i + 1}" type="${typeLabel}">\n    ${s.description}\n  </step>\n`;
        });
        prompt += "</logic_process>\n\n";
    }

    prompt += "<output_format>\n";
    if (sig.outputs.length === 0) {
        prompt += "<!-- No specific structured output format defined -->\n";
    } else {
        sig.outputs.forEach((f: any) => {
            prompt += `  <field name="${f.name}" type="${f.type}" />\n`;
        });
    }
    prompt += "</output_format>";

    return prompt;
};
