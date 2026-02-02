# User Guide: Prompt Engineer Studio

This guide explains how to use the Studio to create professional-grade AI prompts.

## 1. The Prompt Editor (Workshop)

The main interface for creating and refining prompts.

### Core Features
*   **Prompt Input**: The main text area. You can write normally here.
*   **Metacognitive Refine (Button)**: The "Magic Wand". When clicked, an AI Architect Agent analyzes your prompt and rewrites it using best practices (XML structure, Chain of Thought).
*   **Zero-Config Mode (Toggle)**:
    *   **Enabled (Default)**: The system *skips* the interview phase. It looks at your text, guesses what you want (Code vs. Writing vs. Planning), and immediately optimizes it. **Best for speed.**
    *   **Disabled**: The system acts as a consultant. It will ask you clarifying questions (e.g., "Who is the target audience?") before generating the final prompt. **Best for complex, vague ideas.**
*   **Variables**: Use `{{variable_name}}` syntax. The editor will detect these and allow you to test them in the "Debugger Console".

### Attachments & Context
*   **Knowledge Base**: You can upload PDFs, text files, or images. The Refine agent will "read" these documents and incorporate their specific knowledge into the generated prompt.

---

## 2. Battle Arena (Evaluation)

The " Coliseum" where prompts fight for supremacy. Use this to compare your Original Prompt (A) vs. the Optimized Prompt (B).

### How to Battle
1.  **Select Contenders**: Automatically populated from the Editor, or load from History.
2.  **Difficulty Slider (1-10)**:
    *   **Low (1-3)**: Generates simple, straightforward test cases. Good for sanity checks.
    *   **Medium (4-7)**: Adds noise and ambiguity to the inputs.
    *   **High (8-10)**: **"Red Team Mode"**. The system actively tries to break your prompt with "Edge Cases" (e.g., empty inputs, malicious injections, different languages). Use this for production-ready prompts.
3.  **Start Battle**:
    *   The system generates 3+ synthetic scenarios based on the difficulty.
    *   It runs both prompts against these scenarios.
    *   A "Judge AI" evaluates the output of each and declares a winner/tie.

### Results
*   **Global Verdict**: Who won overall?
*   **Bias Detection**: If the system detects "Position Bias" (where the model creates a tie or flips randomly), it will warn you with an "Inconclusive" tag.

---

## 3. Advanced Tools

### APE Evolution (The Biotech Lab)
IF you have a clear winner, but it's not perfect (score < 100), click **"Evolve Winner"**.
*   The system takes the winning prompt and the judge's negative feedback.
*   It generates a "Mutation" that specifically fixes the flaws found in the battle.

### The Forge (Signature Composer)
*   **Cyan Factory Icon**.
*   A visual builder for creating structured "Agent Signatures" (Inputs -> Logic -> Outputs) without writing XML manually.

### The Sentinel (Security)
*   **Red Shield Icon**.
*   Runs security audits against your prompt to check for "Prompt Injection" vulnerabilities.
