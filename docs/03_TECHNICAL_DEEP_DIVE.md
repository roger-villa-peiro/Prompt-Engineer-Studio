# Technical Deep Dive: Algorithms & Logic

This document details the internal logic of the core engines powering Prompt Engineer Studio.

## 1. The SIPDO Algorithm (Battle Arena)
**Scientific Iterative Prompt Data Optimization**

 SIPDO is the evaluation protocol used in the Battle Arena. It replaces manual "eye-balling" with statistical rigor.

### Phase 1: Synthetic Data Generation
The system does not use static datasets. It employs a "Red Team Generator" to create dynamic test cases based on the *actual content* of the prompts being tested.
*   **Simple Cases**: Ideal path execution.
*   **Complex Cases**: Noisy data, ambiguity, mixed languages.
*   **Edge Cases (Difficulty > 7)**: Malicious injections, empty nulls, extreme length.

### Phase 2: Interleaved Execution (The Windsurf Pattern)
To eliminate "Position Bias" (where LLMs prefer the first or second option regardless of quality), SIPDO executes 4 parallel threads:
1.  Judge A vs B
2.  Judge B vs A (Swapped)
3.  Judge A vs B (Retry/Verify)
4.  Judge B vs A (Retry/Verify)

If the winners differ between 1 and 2, the system declares **"Inconclusive / Bias Detected"**.

---

## 2. Refine State Machine (The Architect)

The Refine button operates on a 3-stage state machine:

### Stage 1: The Router (Flash Guard)
*   **Model**: `Gemini 2.0 Flash`
*   **Logic**: Analyzes the user input and history.
*   **Output**: Classifies intent into `CODING`, `WRITING`, or `PLANNING`. This determines the "Archetype" (System Prompt) injected in the next step.

### Stage 2: The Interviewer (Optional)
*   **Model**: `Gemini 3.0 Pro`
*   **Logic**: Checks if the request is defined enough.
*   **Zero-Config Bypass**: If "Zero Config" is ON, this stage is force-skipped, and the system assumes optimal defaults based on the Router's classification.

### Stage 3: The Architect (Execution)
*   **Logic**: Applies the professional framework (e.g., XML Tags, Chain of Thought) suited for the Archetype.
*   **Output**: The final structured prompt.

---

## 3. APE: Unity Evolution Engine
**Automatic Prompt Engineering**

APE uses a genetic algorithm approach, but simplified for "Single-Shot Perfection".
1.  **Diagnosis**: Reads the `SIPDO` failure logs (why did the prompt lose?).
2.  **Synthesis**: Uses `Gemini 3.0 Pro` to design a "Master Mutation" that addresses *all* identified failures simultaneously.
3.  **Validation**: A generic "Convergence Check" prevents the AI from changing a valid prompt just for the sake of changing it. If the mutation is semantically identical to the original, evolution stops.

---

## 4. Cognitive Architectures (AI Thought Process)

The system uses specific "Meta-Prompts" to govern how agents think. This ensures they don't just "chat", but actually work as engineers.

### A. The Architect's Mindset (XML-Native)
The Architect doesn't "write text", it **builds modules**. Its internal thought process follows this strict flow:
1.  **Deconstruct**: Break down the user request into core requirements.
2.  **Strategy Selection**:
    *   **Logic Mode**: If the target model is "Smart" (e.g., Gemini 1.5 Pro), it uses `XML_CLEAN_STRUCTURAL`. It removes forced "step-by-step" to save tokens and prioritize information density.
    *   **Instruction Mode**: If the target model is "Fast" (e.g., Gemini Flash), it uses `XML_COT_FEWSHOT_ENFORCED`. It injects explicit chain-of-thought examples to guide the simpler model.
3.  **Modularization**: It mentally drafts the XML tags (`<role>`, `<constraints>`, `<output_format>`) before writing a single word of the prompt.

### B. The Biologist's Mindset (Unity Optimization)
Unlike older "Beam Search" methods that guess randomly, the Biologist **synthesizes**.
1.  **Ingestion**: Reads the "Base Genome" (Previous Winner) + "Environmental Pressure" (Why it lost the battle).
2.  **Logic Trace**: Generates a reasoning block in **Spanish** to explain *why* it is making changes (e.g., "Adding JSON schema constraints because the model failed edge case #3").
3.  **Master Mutation**: Produces a single, perfect JSON object that fixes all identified issues at once.

### C. The Interviewer (Emotional Density)
The "Poke Persona" (Warm, Witty, Concise).
*   **Frustration Check**: If the user says "idk" or "just do it", the agent stops asking questions and switches to "Creative Improvisation".
*   **Sufficiency Check**: It only asks a question if the missing information is *critical* to the architecture. It avoids bureaucratic forms.

