# Signature Composer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a visual "Signature Composer" component (inspired by DSPy) that allows users to define agents declaratively (Inputs, Logic, Outputs) and compiles them into a structured prompt. This will sit alongside the existing text-based editor as a new "Forge" mode.

**Architecture:**
*   **Data Model**: Define `AgentSignature` interface (inputs, steps, outputs).
*   **UI**: `SignatureComposer` component with form fields for defining the signature.
*   **Compilation**: A utility function `compileSignatureToPrompt(signature)` that generates the text prompt.
*   **Integration**: Add a new route `/forge` (or similar) in `App.tsx` to host this new editor, eventually linking it to the 'Optimizer'.

**Tech Stack:** React, Tailwind CSS (existing).

---

### Task 1: Define Signature Types

**Files:**
- Modify: `types.ts`

**Step 1: Add Interfaces**

Add the following interfaces to `types.ts`:

```typescript
export interface SignatureField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'list';
  description?: string;
  required: boolean;
}

export interface ReasoningStep {
  id: string;
  type: 'CoT' | 'ReAct' | 'Reflexion';
  description: string;
}

export interface AgentSignature {
  name: string;
  description: string;
  inputs: SignatureField[];
  steps: ReasoningStep[];
  outputs: SignatureField[];
}
```

**Step 2: Commit**

---

### Task 2: Create Signature Composer Logic & UI

**Files:**
- Create: `components/SignatureComposer.tsx`
- Create: `utils/signatureCompiler.ts`

**Step 1: Create Compiler Utility**

Create `utils/signatureCompiler.ts`:
```typescript
import { AgentSignature } from '../types';

export const compileSignatureToPrompt = (sig: AgentSignature): string => {
  let prompt = `ROLE: ${sig.name}\nTASK: ${sig.description}\n\n`;
  
  prompt += "INPUTS:\n";
  sig.inputs.forEach(f => prompt += `- ${f.name} (${f.type}): ${f.description || ''}\n`);
  
  prompt += "\nLOGIC:\n";
  sig.steps.forEach((s, i) => prompt += `${i+1}. [${s.type}] ${s.description}\n`);
  
  prompt += "\nOUTPUT FORMAT:\n";
  sig.outputs.forEach(f => prompt += `- ${f.name} (${f.type})\n`);
  
  return prompt;
};
```

**Step 2: Create Component Scaffolding**

Create `components/SignatureComposer.tsx` (Basic structure with name/desc inputs).

**Step 3: Implement Field Editor**

Add functionality to add/remove Inputs and Outputs in `SignatureComposer`.

**Step 4: Implement Preview**

Use `compileSignatureToPrompt` to show a live preview of the generated prompt.

---

### Task 3: Integrate into App

**Files:**
- Modify: `App.tsx`
- New Route: `/forge`

**Step 1: Add Route**

Import `SignatureComposer` and add:
`<Route path="/forge" element={<SignatureComposer onSave={(prompt) => { setCurrentPrompt(prompt); navigate('/'); }} />} />`

**Step 2: Add Navigation**

Add a link/button in the main implementation (or a nav bar if it exists) to switch to "Forge Mode".

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-01-24-signature-composer.md`.**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.
