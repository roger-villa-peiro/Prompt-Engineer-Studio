# Informe de Capacidades: Prompt Engineer Studio

Este documento detalla las funciones y características de la aplicación **Prompt Engineer Studio**, una herramienta de entorno de desarrollo integrado (IDE) para la ingeniería de prompts avanzada.

## 1. Propósito de la Aplicación
Prompt Engineer Studio es una plataforma diseñada para **diseñar, refinar, evaluar y versionar prompts** de IA de nivel profesional. Su objetivo es transformar la ingeniería de prompts de un proceso de prueba y error a un flujo de trabajo científico y estructurado.

## 2. Características Principales

### A. Editor de Prompts (Prompt Editor)
Es el núcleo de la aplicación.
*   **Refinamiento Inteligente (Refine)**: Utiliza un sistema de agentes (Arquitecto y Crítico) para mejorar automáticamente tus prompts basándose en frameworks profesionales (RTF, COT, TAG).
*   **Variables Dinámicas**: Soporta la inserción de variables como `{{nombre}}` o `{{datos}}` que se pueden probar en tiempo real.
*   **Modo Ensayo (Playground)**: Ejecución directa del prompt contra modelos de IA (Gemini, Groq) para ver resultados inmediatos.

### B. Arena de Batalla SIPDO (Scientific Benchmark)
El estándar de oro para la evaluación de prompts.
*   **Ciclo SIPDO**: *Synthetic Iterative Prompt Data Optimization*. Genera casos de prueba sintéticos (Simples, Complejos, Edge Cases) para estresar el prompt.
*   **Ejecución Entrelazada (Interleaved)**: Ejecuta comparaciones A vs B y luego B vs A para eliminar el Sesgo de Posición y detectar inconsistencias.
*   **Juez Resiliente**: Un sistema de arbitraje que sobrevive a caídas de API (429) usando cadenas de respaldo (Llama -> GPT -> Gemini Flash).

### C. APE (Unity Evolution Engine)
Evolución unificada de tus prompts.
*   **Master Mutation**: El sistema sintetiza mejoras estructurales y cognitivas en una única versión superior, eliminando la necesidad de probar múltiples ramas débiles.
*   **Convergence Check**: Detecta automáticamente si el prompt ya es óptimo.

### D. Dashboard de Evaluación ("Judge AI")
Un sistema de métricas cuantitativas para asegurar la calidad antes de producción.
*   **Auditoría de Calidad**: Asigna un puntaje (0-100) al desempeño del prompt.
*   **Métricas Específicas**: Coherencia, Fidelidad, Toxicidad, Validez JSON.
*   **Estimación de Costos**: Muestra el tiempo de respuesta y consumo de tokens.

### E. Historial y Control de Versiones
Sistema de gestión del ciclo de vida del prompt (Timeline, Restauración, Diff Visual).

### F. Gestión de Contexto Multimodal (Knowledge Base)
**NUEVO**: Capacidad de inyectar conocimiento externo directamente en la "memoria de trabajo" de la IA.
*   **Soporte de Archivos**: Carga de documentos PDF e Imágenes.
*   **Procesamiento Nativo**: El modelo (Gemini 2.5) "ve" y "lee" los adjuntos para generar prompts contextuales, en lugar de solo pegar texto plano.

## 3. Arquitectura Técnica (V2 - AI Native)

*   **Frontend**: React 19 + Vite + TailwindCSS.
*   **Inteligencia Artificial**:
    *   **Router V2**: `Gemini 2.0 Flash` (Clasificación Semántica de Intención + Subtipos).
    *   **Orchestrator**: `Gemini 2.5 Pro` (Thinking Logic, Unity Evolution).
    *   **Spec Architect**: Máquina de estados para diseño interactivo (Requirements -> Design -> Tasks).
*   **Servicios Cognitivos**:
    *   `geminiService`: Orquestación y State Machine del Arquitecto.
    *   `routerService`: Gateway inteligente que decide el "Archetype" (Coding, Planning, Writing).
    *   `vibeService`: **(Vibe Coder)** Detección automática del stack tecnológico (React, Tailwind, etc.) leyendo `package.json`.
    *   `knowledgeService`: **(Parallel RAG)** Búsqueda simulada en paralelo para inyectar contexto fresco (Next.js 15, React 19).
    *   `optimizerService`: Lógica genética para APE.

## 4. Flujo de Trabajo Típico (V2)

1.  **Input (Gateway Router)**: El usuario envía un mensaje. El sistema clasifica la intención (CODING, PLANNING, WRITING) y activa el **Vibe Coder** y **Knowledge Search** en paralelo.
2.  **Interactive Planning (Spec Architect)**:
    *   Si es complejo, el agente inicia una entrevista (EARS).
    *   Genera un Diagrama de Arquitectura (Mermaid).
    *   Genera un Plan de Tareas (TDD).
3.  **Refine**: El "Arquitecto" inyecta el blueprint específico y optimiza el prompt final.
4.  **Battle (Parallel)**: Se ejecutan 2 variantes (A/B) en paralelo para encontrar la mejor estructura.
5.  **Analyze**: Revisas el reporte de batalla y el feedback del juez.
6.  **Evolve (APE)**: Si pierdes, usas el "Biólogo Evolutivo" para generar un contraataque.
7.  **Commit**: Guardas la versión ganadora con tagging automático.
