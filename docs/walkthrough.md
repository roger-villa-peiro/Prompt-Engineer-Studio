# Signature Composer Implementation Walkthrough

**Goal:** Implement the "Signature Composer" (Option B) to allow declarative agent design.

## Changes Created

### 1. **New Core Types (`type.ts`)**
Added `AgentSignature`, `SignatureField`, and `ReasoningStep` interfaces to define the structure of an AI agent's "DNA".

### 2. **Compiler Utility (`utils/signatureCompiler.ts`)**
Created a utility that takes the JSON signature and compiles it into a structured text prompt.
*   **Format**: `ROLE` -> `INPUTS` -> `LOGIC` -> `OUTPUT`.
*   **Feature**: Handles optional fields and descriptions automatically.

### 3. **The "Forge" UI (`components/SignatureComposer.tsx`)**
Built a visual editor with 3 main sections:
*   **Inputs**: Define what the agent receives (e.g., `user_query`, `documents`).
*   **Logic**: Define the reasoning steps (CoT, ReAct, Reflexion).
*   **Outputs**: Define the expected JSON structure.
*   **Preview**: Real-time compilation of the prompt.
*   **Aesthetic**: Used the "Neon Void" theme (Deep dark background, Cyan/Amber accents).

### 4. **Integration**
*   **Route**: Added `/forge` in `App.tsx`.
*   **Toolbar**: Added a "Precision Manufacturing" icon (`precision_manufacturing`) to the main toolbar to access the Forge.

## Verification

### Manual Verification Steps
1.  Open the application.
2.  Click the new **"Forge" icon** (Cyan color) in the toolbar.
3.  **Create a Signature**:
    *   Add an input `question` (String).
    *   Add a logic step (Chain of Thought).
    *   Add an output `answer` (String).
4.  Observe the **Live Preview** on the right side updating instantly.
5.  Click **"Export to Editor"**.
6.  Verify that you are navigated back to the main editor and the prompt is populated with the compiled text.

## Next Steps (Option A)
Now that the Logic is built, we can proceed to **Option A: Design System**, to apply the "Cyber-Industrial" theme globally (changing fonts to Space Grotesk, updating the global background, etc.).
