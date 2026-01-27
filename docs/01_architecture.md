# AI Forge Architecture

## Vision
**Prompt Engineer Studio** has evolved into **AI Forge**, a professional IDE for engineering cognitive agents. It moves beyond simple text editing to a "Compile & Verify" workflow.

## Core Pillars

### 1. The Forge (Agent Compiler)
*   **Goal**: Define *Intent*, compile *Implementation*.
*   **Mechanism**: Uses `SignatureComposer` to capture Inputs, Logic, and Outputs separately.
*   **Output**: Generates standardized XML-structured prompts (`<role>`, `<inputs>`, `<logic_process>`).
*   **Tech**: `utils/signatureCompiler.ts` handles the XML generation.

### 2. The Sentinel (Security Auditor)
*   **Goal**: Automated Red-Teaming.
*   **Mechanism**: Runs the compiled prompt against a battery of adversarial attacks (DAN, Token Leakage, Translation).
*   **Scoring**: Provides a 0-100 Resilience Score.
*   **Tech**: `services/securityService.ts` executes attacks defined in `data/attacks.ts`.

### 3. The Thinker (Advanced Reasoning)
*   **Goal**: Elevate cognitive performance.
*   **Mechanism**: Library of high-performance templates accessible via the workspace.
*   **Templates**: 
    - **Code-Guided**: Forces Python pseudocode planning.
    - **Meta-Prompt**: Self-optimizing prompts.
    - **XML Agent**: Standard robust structure.
*   **Tech**: `data/templates.ts`.

## Legacy Modules (Maintained)
*   **Battle Arena (SIPDO)**: A/B Testing with position bias detection.
*   **Evaluator (Judge AI)**: Metric-based quality assessment (Faithfulness, Coherence).
