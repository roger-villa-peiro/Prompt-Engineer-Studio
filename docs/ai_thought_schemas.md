# Esquemas de Pensamiento de la IA (AI Thought Schemas)

Este documento detalla los **metaprompts** y los flujos cognitivos internos que gobiernan a los agentes de IA dentro de Prompt Engineer Studio. Define "cómo piensan" el Arquitecto, el Biólogo y el Juez.

## 1. El Arquitecto (Architect Agent)
**Función:** Transformar intención cruda en ingeniería de precisión.

## 0. El Router (Intent Gateway)
**Función:** Clasificación de alta velocidad (Low Latency).

### Esquema de Pensamiento (Tri-State Classification)
El Router no razona profundamente, **discrimina**. Usa un modelo ligero (`gemini-2.0-flash`) para enrutar el tráfico en < 500ms.
1.  **Analiza Historial + Último Mensaje**.
2.  **Clasifica en**:
    *   `CHAT`: Conversación casual, saludos, preguntas simples. (Cost: Low)
    *   `SPEC`: Solicitudes de trabajo (Crear, Refinar, Optimizar). (Cost: High - Activa Architect)
    *   `TEST`: Solicitudes de ejecución o playground. (Cost: Medium)
3.  **Salida**: JSON `{ mode: "SPEC", confidence: 0.99 }`.

## 1. El Entrevistador (Clarity Agent: "Poke Persona")
**Función:** Guardián de calidad de entrada con inteligencia emocional.

### Esquema de Pensamiento (Emotional Density Analysis)
El agente adopta la personalidad **"Poke"** (Cálido, Ingenioso, Conciso).
1.  **Check de Frustración**: ¿Está el usuario molesto ("idk", "hazlo tú")? -> Pivotar a Creativo.
2.  **Check de Suficiencia**: ¿Falta información crítica?
3.  **Acción**:
    *   Si **SÍ**: Status `READY`.
    *   Si **NO**: Pregunta "witty" (ingeniosa) y breve. Evita sonar como un formulario burocrático.
    *   *Ejemplo*: "Entendido el concepto, pero... ¿esto es para una app seria o para trolear a tus amigos? (Necesito el tono)".

## 1. El Arquitecto (Architect Agent)
**Función:** Transformar intención cruda en ingeniería de precisión.

### Esquema de Pensamiento (XML-Native)
El Arquitecto no "escribe texto", **construye módulos**. Su proceso mental sigue este flujo estricto:

1.  **Análisis de Intención**: Deconstruye el pedido del usuario para identificar la "Core Task".
2.  **Selección de Estrategia**:
    *   Si el modelo destino es <Thinking> (ej. o1, Gemini Pro): Activa modo `XML_CLEAN_STRUCTURAL`. Elimina el "step-by-step" forzado y prioriza la densidad de información.
    *   Si el modelo destino es <Fast> (ej. Flash, Llama 8b): Activa modo `XML_COT_FEWSHOT_ENFORCED`. Inyecta cadenas de pensamiento explícitas y ejemplos few-shot.
3.  **Modularización (XML)**:
    ```xml
    <thinking>
      (Aquí define la estrategia oculta antes de generar el prompt final)
    </thinking>
    <prompt_structure>
      <role>...</role>
      <context>...</context>
      <instruction>...</instruction>
      <constraints>...</constraints>
    </prompt_structure>
    ```

## 2. El Biólogo Evolutivo (APE - Unity Engine)
**Función:** Sintetizar la "Master Mutation" perfecta.

### Esquema de Pensamiento (Unity Optimization)
A diferencia de los enfoques antiguos (Beam Search), el Biólogo **no adivina**, **sintetiza**.

1.  **Ingesta de Datos (Data Ingestion)**:
    *   Lee el `Base Genome` (Prompt Ganador Anterior).
    *   Analiza la `Evolutionary Pressure` (Por qué ganó vs el perdedor durante la batalla).
    *   Estudia los `Environmental Failures` (Casos donde falló < 70%).

2.  **Síntesis Estructural (The Logic Trace)**:
    *   Genera un bloque de razonamiento en **Español** (`reasoning`) que actúa como puente cognitivo.
    *   Integra:
        *   **Mejoras Estructurales** (Formato, XML integrity).
        *   **Mejoras Cognitivas** (Tone, COT, Reasoning style).
        *   **Mejoras Few-Shot** (Inyección de ejemplos basados en fallos reales).

3.  **Generación de la Mutación Maestra**:
    Produce un único objeto JSON `master_mutation` que es la suma de todas las mejores características posibles.

## 3. El Jurado SIPDO (Dual-Model Jury)
**Función:** Evaluación objetiva y resiliente.

### Esquema de Pensamiento (Adversarial Consensus)
El juicio no es unilateral. Se basa en la diversidad cognitiva de dos LLMs SOTA.

#### Juez 1: The Primary (Gemini 2.5 Pro)
*   **Rol**: El analista profundo.
*   **Foco**: Busca matices, razonamiento lógico complejo y adherencia sutil a la instrucción.
*   **Salida**: JSON estricto con razonamiento en Español.

#### Juez 2: The Secondary (Llama 3.3 70b / Fallback Chain)
*   **Rol**: El crítico pragmático.
*   **Foco**: Robustez, seguridad y "sentido común".
*   **Resiliencia**: Si Llama falla, activa la cadena de backup (GPT-OSS-120b -> Gemini 2.5 Pro) para asegurar un veredicto.

### Consenso
El sistema toma los veredictos de ambos jueces y:
1.  **Promedia** los puntajes.
2.  **Concatena** los razonamientos.
3.  Determina el ganador solo si la diferencia es significativa (>2 puntos), eliminando el ruido aleatorio.
