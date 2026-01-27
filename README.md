# Antigravity Architect 🚀 (v4.0)

> **The Professional IDE for Prompt Engineering**
> *Craft, Refine, and Evaluate LLM Prompts with Cognitive Intelligence.*

**Antigravity Architect** (formerly Prompt Engineer Studio) is a production-grade environment designed for Prompt Engineers who need more than a simple chat interface. It combines the utility of a code editor with the intelligence of an LLM evaluation pipeline.

![Status](https://img.shields.io/badge/Status-Production_Ready-success) ![Stack](https://img.shields.io/badge/Stack-React_|_Supabase_|_Vite-blue) ![AI](https://img.shields.io/badge/AI-Gemini_3.0_Pro_Ready-purple)

## ✨ key Features

### ⚡ Pro Editor & Workflow
- **Rich Prompt Editor**: Real-time **Token Counter** and **Variable Detector** (`{{variable}}`) HUD.
- **Template Library**: Bootstrap projects with industry-standard patterns ("Senior Code Architect", "Data Extractor").
- **Smart Export**: Generate production-ready **Python (OpenAI)** and **Node.js** snippets instantly.

### 🧠 Cognitive Engine
- **Metacognitive Refinement**: The AI doesn't just rewrite; it "thinks" about your prompt using a visible reasoning chain before optimizing it.
- **Evaluation Dashboard**: LLM-as-a-Judge analysis of prompt outputs (Accuracy, Styles, Safety).
- **A/B Battle Arena**: Compare two models side-by-side.

### 🤝 Unity & Cloud
- **Cloud Sync (Supabase)**: Your history and versions persist across sessions.
- **Version Control**: Auto-save with diff views (Original vs. Refined).
- **Public Sharing**: Generate read-only links to share specific prompt versions with your team.

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/antigravity-architect.git
   cd antigravity-architect
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```
   *(Note: The Gemini API Key is entered in the UI for security)*

4. **Run Locally**
   ```bash
   npm run dev
   ```

## 📐 Architecture

- **Frontend**: React 18 + Vite + TailwindCSS
- **State**: React Hooks + LocalStorage + Supabase
- **Visuals**: Glassmorphism UI (Surface Dark theme)
- **Icons**: Google Material Symbols

## 🚀 Roadmap (Future)
- [ ] Real-time Multi-user Collaboration (WebSockets)
- [ ] Custom Model Fine-tuning UI
- [ ] Team Workspaces

---
*Built with ❤️ by the Antigravity Team*