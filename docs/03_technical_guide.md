# Technical Guide

## Directory Structure
*   `/components`: UI React Components.
    *   `/forge`: Components for the Signature Composer.
    *   `/sentinel`: Components for the Security Dashboard.
*   `/services`: Business logic (API calls, Security Audit).
    *   `securityService.ts`: Runs the adversarial loop.
    *   `geminiService.ts`: Interacts with LLM Provider.
*   `/data`: Static configuration.
    *   `attacks.ts`: Definitions of security attack vectors.
    *   `templates.ts`: Library of reasoning templates.
*   `/utils`: Helpers.
    *   `signatureCompiler.ts`: Transforms AgentSignatures into XML Prompt Strings.

## Extending the System

### Adding a New Attack
1.  Open `data/attacks.ts`.
2.  Add a new `AttackVector` object to `KNOWN_ATTACKS`.
3.  Define the `payload` (the malicious user message) and `expectedRefusal` keywords.

### Adding a New Template
1.  Open `data/templates.ts`.
2.  Add a new `PromptTemplate` object to `ADVANCED_TEMPLATES`.
3.  Use `{{PLACEHOLDERS}}` for dynamic parts if supported by the UI later.

### Modifying the Compiler
1.  Open `utils/signatureCompiler.ts`.
2.  Edit `compileSignatureToPrompt`.
3.  Change the XML tags or structure (e.g., `<thinking>` instead of `<logic_process>`).
