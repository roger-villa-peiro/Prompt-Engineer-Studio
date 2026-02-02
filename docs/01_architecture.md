# Architecture Overview: Prompt Engineer Studio

## 1. System Purpose
Prompt Engineer Studio is a **Scientific IDE for Prompt Engineering**. Unlike simple chat interfaces, this tool transforms prompt creation from an art into a measurable science. It is designed to **Design, Refine, Evaluate, and Version** prompts using professional frameworks and adversarial testing.

## 2. Technology Stack (V2 AI-Native)
The application is built on a modern, high-performance stack designed for low latency and high interactivity.

*   **Frontend**: React 19 + Vite + TailwindCSS (Glassmorphism UI).
*   **State Management**: Zustand (local state) + LocalStorage (persistence).
*   **AI Core**:
    *   **Reasoning Engine**: `Gemini 3.0 Pro` (High-cognitive tasks).
    *   **Router/Speed Engine**: `Gemini 2.0 Flash` (Intent classification, simple tasks).
    *   **Adversarial Judge**: Dual-Model Jury (Gemini + Llama 3 via Groq) for unbiased evaluation.

## 3. Core Modules

### A. The Editor (Cognitive Refine)
The central workspace. It doesn't just edit text; it actively collaborates with you.
*   **Architect Agent**: Analyzes your input and restructures it into XML-based SOTA (State of the Art) prompts.
*   **Zero-Config Mode**: A specialized mode that bypasses the interview phase for rapid iteration.

### B. Battle Arena (SIPDO)
The evaluation engine.
*   **SIPDO Algorithm**: *Scientific Iterative Prompt Data Optimization*.
*   **Function**: Generates synthetic test cases (Simple, Complex, Edge) to scientifically compare two prompts (A vs B) and declare a winner based on empirical data, not vibes.

### C. APE (Unity Evolution)
The optimization engine.
*   **Automatic Prompt Engineering**: Takes the winner of a battle and "mutates" it to fix specific weaknesses found during testing.
*   **Convergence Check**: Intelligent system that knows when a prompt cannot be improved further.

### D. The Router (Flash Guard)
An intelligent traffic control system.
*   **Function**: Intercepts every user message.
*   **Logic**: If it's a simple "Hi", it uses a cheap model (Flash). If it's "Optimise this prompt for a legal bot", it routes to the expensive reasoning model (Pro). This optimizes cost and latency by ~90%.

## 4. Data Flow
1.  **Input**: User enters a raw idea.
2.  **Route**: System classifies intent (`SPEC` vs `CHAT`).
3.  **Refine**: Architect transforms raw idea -> Engineered Prompt.
4.  **Battle**: User compares New Prompt vs Old Prompt in the Arena.
5.  **Commit**: Validated prompt is saved to the Repository.
