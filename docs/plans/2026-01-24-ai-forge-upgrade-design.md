# AI Systems Forge: Upgrade Proposal for Prompt Engineer Studio

**Based on deep research from notebooks: "Ingeniería de Prompts y Optimización de Agentes IA 2025" & "AUTO IA"**

## 1. Executive Summary

The current "Prompt Engineer Studio" will be evolved into an **"AI Systems Forge"**. Moving beyond simple text editing, this upgrade introduces **Declarative Agent Design**, **Closed-Loop Optimization**, and a **"Cyber-Industrial" Aesthetic** to reflect the advanced nature of the tools.

## 2. Key Concept: From "Writing" to "Forging"

Insights from the notebooks suggest a shift from manual prompt crafting to **automated optimization**:
*   **"DSPy-Style" Signatures**: defining *what* runs, not *how*.
*   **Closed-Loop Optimization**: Agents that improve themselves against data.
*   **Context Management**: Explicit tools to view and compact state.

## 3. Proposed Feature Set

### A. The "Signature Composer" (Visual Editor)
*Replaces the simple text area.*
*   **Functionality**: A node-based or structured form builder to define:
    *   **Inputs**: (e.g., `user_query`, `context_docs`)
    *   **Reasoning Steps**: (e.g., `ChainOfThought`, `ReAct`)
    *   **Output Schema**: (enforced JSON/XML structure)
*   **Notebook Insight**: Aligns with the "Declarative Programming" concept seen in DSPy.

### B. The "Optimizer Loop" Dashboard
*New Tab*
*   **Functionality**:
    *   **Input**: A seed prompt and a dataset (or a "Synthetic Data Generator" tool).
    *   **Process**: visualizes the agent iterating (Generation -> Evaluation -> Refinement).
    *   **Visuals**: Graphs showing "Accuracy vs Cost" and "Score over Time".
    *   **Controls**: A "Efficiency/Performance" slider (as suggested by the "Promptomatix" research).

### C. The "Context Lens"
*New Sidebar Utility*
*   **Functionality**: Real-time visualization of token usage.
*   **Insight**: Implements the "Context Compaction" and "State Management" principles.
*   **Visuals**: A fragmented bar representing the context window, showing "System", "History", "RAG Data", and "Free Space".

## 4. Design System Proposal: "Cyber-Industrial"

We will apply the **Frontend Design** skill to create a "BOLD" aesthetic.

**Theme Name**: *Neon Void*

*   **Philosophy**: The UI should feel like a high-performance instrument or a cockpit. Dark, precise, and responsive.
*   **Typography**:
    *   **Headers**: *Space Grotesk* (Geometric, technical).
    *   **Body**: *Inter* (Clean, readable).
    *   **Code/Data**: *JetBrains Mono* (The standard for engineering).
*   **Color Palette**:
    *   **Background**: Deep Void (`#030712`) - darker than typical "Dark Mode".
    *   **Surface**: Gunmetal (`#111827`) with subtle noise texture.
    *   **Accents**:
        *   *Cyan* (`#06b6d4`): For creative actions (Generate, Compose).
        *   *Amber* (`#f59e0b`): For optimization/processing states.
        *   *Crimson* (`#ef4444`): For critical errors or "High Cost" warnings.
*   **Visual Drivers**:
    *   **Glassmorphism**: Used on floating panels (Context Lens).
    *   **Micro-interactions**: buttons "glow" on hover; graphs "draw" themselves live.
    *   **Borders**: 1px crisp borders with low opacity (`rgba(255,255,255,0.1)`).

## 5. Implementation Roadmap (Next Steps)

1.  **Refactor CSS**: Install Tailwind v4 (if not already optimized) and set up the *Neon Void* variables in `index.css`.
2.  **Create "Signature" Component**: Build the structured input form.
3.  **Build "Optimizer" Layout**: Create the dashboard shell.
4.  **Integrate**: Connect to backend (mocked for now) to demonstrate the flow.

> **User Decision Required**:
> Do you want to start by generating the **Design System** (CSS/Theme) first to see the visual change, or focusing on the **Signature Composer** logic first?
