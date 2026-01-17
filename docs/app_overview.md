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

## 3. Arquitectura Técnica

*   **Frontend**: React 19 + Vite + TailwindCSS.
*   **Inteligencia Artificial**:
    *   **Orchestrator**: `Gemini 2.5 Pro` (Thinking Logic, Unity Evolution).
    *   **Dual Jury**: 
        *   Primary: `Gemini 2.5 Pro` (Google).
        *   Secondary: `Llama 3.3 70b` (Groq) + `GPT-OSS-120b` (Fallback).
*   **Resiliencia**:
    *   **Triple-Layer Safety Net**: Sistema de backups (Llama -> GPT -> Gemini) que garantiza 99.9% de disponibilidad en evaluaciones.
    *   **Rate Limit Handling**: Gestión inteligente de esperas y backoff exponencial.
*   **Almacenamiento**:
    *   **Local Backend**: Sistema de archivos local para persistencia rápida en desarrollo.
    *   **Supabase (Integración preparada)**: Capa de base de datos para características en la nube.
*   **Servicios Cognitivos**:
    *   `geminiService`: Orquestación de llamadas a Google AI (incluyendo generación de casos de prueba).
    *   `judgeService`: Lógica de auditoría resilient y arbitraje SIPDO.
    *   `optimizerService`: Lógica genética para APE.

## 4. Flujo de Trabajo Típico
1.  **Draft**: Escribes una idea básica.
2.  **Refine**: El "Arquitecto" sugiere una estructura profesional.
3.  **Battle (SIPDO)**: El sistema genera casos de prueba y enfrenta tu prompt contra la versión anterior.
4.  **Analyze**: Revisas el reporte de batalla y el feedback del juez.
5.  **Evolve (APE)**: Si pierdes, usas el "Biólogo Evolutivo" para generar un contraataque (Gen C).
6.  **Commit**: Guardas la versión ganadora en el historial.
