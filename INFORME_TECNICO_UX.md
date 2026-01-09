# INFORME TÉCNICO: Auditoría de Funcionalidad y UX
**Fecha:** 09/01/2026
**Auditor:** Lead QA & HCI Expert
**Versión Auditada:** `Prompt Engineer Studio` (Refactor `geminiService.ts`)

---

Este informe detalla el estado actual de la "Salud del Producto" desde una perspectiva puramente técnica y de interacción. Se han analizado los archivos críticos (`geminiService.ts`, `PromptEditor.tsx`, `systemPrompts.ts`) simulando flujos de usuario intensivos.

## SECCIÓN 1: LATENCIA COGNITIVA Y FEEDBACK

**Estado Actual:**
El sistema procesa peticiones complejas (Arquitecto -> Crítico -> Batalla) lo que introduce una latencia natural. El backend está bien orquestado con `onProgress`, pero la exposición visual es mejorable.

*   **Problema (La "Caja Negra"):** Aunque el backend devuelve un `thinking_process` rico (ver `GET_ARCHITECT_PROMPT` en `systemPrompts.ts`), este valioso output queda **oculto** por defecto dentro de un acordeón colapsado ("🧠 AI Reasoning") *después* de que termina el proceso. Durante la espera, el usuario solo ve "Metacognitive Refine" cambiando a "Thinking..." o un log tipo terminal que puede resultar demasiado técnico ("Auditando calidad estructural...").
*   **Diagnóstico:** El usuario promedio no abrirá el acordeón y perderá la confianza en *por qué* la IA cambió su prompt. Falta "fantasía" en la espera.
*   **Solución (Transparencia Activa):**
    1.  **Streaming de Pensamiento:** En lugar de un log estático, mostrar el `thinking_process` escribiéndose en tiempo real (si fuera posible por stream) o al menos destacar fragmentos clave del log en un elemento visual más grande durante la carga.
    2.  **Auto-Expandir Selectivo:** Si el `criticScore` sube más de 20 puntos, abrir automáticamente el panel de razonamiento para presumir el "buen trabajo" de la IA.

## SECCIÓN 2: AUDITORÍA DE FLUJOS DE ERROR (Edge Cases)

**Simulación de Escenarios Críticos:**

*   **⚠️ Escenario A: Pérdida de Conexión (Network Fail)**
    *   *Código:* `PromptEditor.tsx` captura errores genéricos en `handleApiError`. `geminiService.ts` tiene lógica de reintento (`withBackoff`) pero solo para errores HTTP específicos (429, 503).
    *   *Riesgo:* Si la conexión cae totalmente (error de red puro, no HTTP), el catch genérico muestra un "Error inesperado". **Lo bueno:** El input original del usuario (`content`) NO se borra porque el estado se mantiene. **Lo malo:** No hay persistencia de "borrador en vuelo", si recarga la página esperando que vuelva internet, podría perder cambios no guardados si `localStorage` no se actualizó el último segundo.
*   **🔄 Escenario B: Bucle de Clarificación (Interviewer Loop)**
    *   *Código:* `assessInputClarity` detecta ambiguedad y devuelve `NEEDS_CLARIFICATION`.
    *   *Riesgo:* No existe un mecanismo de "Escape". Si el usuario insiste con respuestas vagas, entra en un bucle infinito de preguntas. Falta un botón "Forzar Optimización de todas formas".
*   **🔥 Escenario C: API 503 Sobrecarga**
    *   *Código:* Excelente manejo en `geminiService.ts`. El sistema realiza 3 reintentos con backoff exponencial antes de rendirse.
    *   *Veredicto:* **Robusto**. El usuario percibe una espera más larga, pero el sistema lucha por completar la tarea.

## SECCIÓN 3: ERGONOMÍA DEL PROMPT (Cognitive Offloading)

**Análisis de Fricción:**

*   **Carga Cognitiva Visual:**
    *   El panel de "Global Context" está enterrado al final de la página (línea 352 de `PromptEditor.tsx`). Es una herramienta crítica para el "Architect" y el usuario podría olvidar que existe, resultando en prompts peores.
    *   El editor de texto permite escribir *mientras* la IA está "Pensando" (`isOptimizing` no deshabilita el `textarea` origen, solo el botón). Esto es peligroso: si el usuario edita una línea clave y luego "Acepta" los cambios de la IA (que se basaron en la versión vieja), se produce una disonancia cognitiva o pérdida de trabajo.
*   **Contador de Clics:**
    *   Para optimizar y usar: Click "Refine" -> Esperar -> Click "Accept Changes" -> Click "Copy" (manual) o "Save".
    *   **Crítica:** Son demasiados pasos para el "Happy Path".
*   **Propuesta (Atajos):**
    *   `Ctrl + Enter`: Ejecutar "Metacognitive Refine".
    *   `Alt + Enter`: Aceptar cambios propuestos inmediatamente.

## SECCIÓN 4: PLAN DE MEJORA FUNCIONAL (Hoja de Ruta)

Prioridad Alta (Quick Wins para Estabilidad y UX):

1.  **Bloqueo de UI durante Proceso (Safety):** Deshabilitar el `textarea` principal (`readOnly={isOptimizing}`) para evitar ediciones concurrentes que se sobrescribirán al aceptar la propuesta.
2.  **Diff Viewer Real (Visual):** Reemplazar los dos `textarea` paralelos con una vista de diferencias (tipo Git) para que el usuario vea exactamente qué palabras cambió el Arquitecto (rojo -> verde).
3.  **Botón de Pánico "Forzar" (Interaction):** En el modal de "Clarificación Requerida", añadir un botón pequeño: *"Ignorar y optimizar como sea"*, pasando un flag al backend para saltar el `Interviewer`.
4.  **Persistencia de Contexto (Resilience):** Mover el "Global Context" a un panel lateral colapsable (junto a archivos) o guardarlo en `localStorage` independientemente, ya que actualmente parece volátil si no se guarda explícitamente.

---
*Fin del Informe*
