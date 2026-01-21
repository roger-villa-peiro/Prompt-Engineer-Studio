# Architect V2: Lógica de Refinamiento

## 🏗️ El Arquitecto (Architect Agent)

La función "Refine" transforma una intención de usuario cruda en un prompt de ingeniería (SOTA). La versión V2 del Arquitecto introduce mejoras estructurales significativas.

### Fase 0: Auditoría de Claridad (The Interviewer - Poke Persona)
Antes de diseñar nada, un agente preliminar (Personalidad "Poke") analiza tu solicitud.
*   **Objetivo**: Verificar si hay suficiente "densidad de información" sin ser molesto.
*   **Inteligencia Emocional**:
    *   Si detecta frustración ("idk", "hazlo tú"), **deja de preguntar** e improvisa una solución creativa.
    *   Usa un tono cálido y "witty" (ingenioso), evitando sonar robótico.
*   **Estado**: `READY_TO_OPTIMIZE` (Procede) vs `NEEDS_CLARIFICATION` (Pausa).

### Características Clave

#### 1. Núcleo XML Estricto
El sistema abandona el Markdown libre por una estructura XML rígida inspirada en DSPy. Esto garantiza modularidad y reduce alucinaciones.
*   `<system_role>`: Definición precisa de la entidad.
*   `<strategy_configuration>`: Reglas operativas.
*   `<input_context>`: Datos variables.
*   `<safety_constraints>`: Límites negativos (lo que NO debe hacer).

#### 2. Estrategia Cognitiva Dinámica
El Arquitecto analiza el modelo de destino (`targetModel`) y adapta via `optimizePromptFlow` la estrategia de razonamiento:

*   **Para Thinking Models (ej. Gemini 2.5 Pro)**:
    *   **Estrategia**: `XML_CLEAN_STRUCTURAL`.
    *   **Lógica**: Se suprime explícitamente el "Chain of Thought" forzado (`Don't use step-by-step`). Se confía en la capacidad nativa de razonamiento del modelo para evitar verborrea innecesaria.

*   **Para Fast Models (ej. Gemini 2.0 Flash)**:
    *   **Estrategia**: `XML_COT_FEWSHOT_ENFORCED`.
    *   **Lógica**: Se fuerza el uso de cadenas de pensamiento ("Let's think step by step") y se inyectan ejemplos Few-Shot para guiar al modelo más simple.

#### 3. Sandbox de Seguridad
Se incluye una sección dedicada `<safety_constraints>` que blinda el prompt contra:
*   Pérdida de variables (`{{variable}}`).
*   Inyecciones de prompt.
*   Generación de contenido dañino.

## 🧐 El Crítico (Critic Agent)

Después del diseño, un agente "Crítico" audita el resultado buscando:
1.  **Integridad XML**: ¿Están cerrados todos los tags?
2.  **Cumplimiento de Seguridad**: ¿Se respetaron las constraints?
3.  **Claridad**: ¿Es el prompt comprensible para un LLM?

Si el score es bajo (<80), el ciclo se repite automáticamente.
