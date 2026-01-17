# SIPDO: Scientific Iterative Prompt Design Optimization

## 🏟️ Battle Arena (SIPDO V2)

La Arena de Batalla es el núcleo de evaluación del sistema. Utiliza una metodología científica para comparar dos versiones de un prompt (A vs B) y determinar cuál es objetivamente mejor.

### Metodología de Evaluación

#### 1. Generación de Datos Sintéticos Adversarios
El sistema no usa casos de prueba estáticos. Utiliza un "Generador Red Team" (`generateTestCases`) que analiza los prompts y crea 3 escenarios de prueba a medida:
*   **Simple**: Caso ideal.
*   **Complex**: Caso con ruido, ambigüedad o datos sucios.
*   **Edge Case**: Caso diseñado para romper la lógica (inyecciones, nulls, cambio de idioma).

**NUEVO (Tool-Use Detection)**: Si el sistema detecta que el prompt solicita JSON o llamadas a herramientas, adapta los casos de prueba para validar esquemas estrictos y tipos de datos, en lugar de solo texto libre.

#### 2. Ejecución Intercalada (Interleaved Execution)
Para evitar el "Position Bias" (sesgo de posición) de los LLMs jueces:
*   **Fase 1**: Se evalúa A vs B.
*   **Fase 2**: Se evalúa B vs A (con los mismos inputs).
*   **Consenso**: Se promedian los resultados. Si el juez cambia de opinión solo por el orden, se marca como "Inconclusive" (Sesgo detectado).

#### 3. Dual-Model Jury (Consenso Adversarial)
El veredicto no es dictado por una sola IA, sino por el consenso de dos modelos de alto rendimiento con arquitecturas diferentes:

*   **Juez Primario (Precision)**: **Gemini 2.5 Pro**.
    *   Se encarga del análisis profundo y matizado.
    *   *Backup*: Gemini 2.5 Pro (Retry Logic).

*   **Juez Secundario (Robustness)**: **Llama 3.3 70b**.
    *   Aporta una visión externa (no-Google) para eliminar sesgos de proveedor.
    *   **Triple-Layer Safety Net**: Si Llama falla (Rate Limit 429), el sistema activa una cadena de supervivencia:
        1.  Intento: Llama 3.3 70b.
        2.  Fallback 1: **GPT-OSS-120b**.
        3.  Fallback 2: **Gemini 2.5 Pro**.
    *   Esto garantiza que **nunca** se pierda una batalla por problemas de infraestructura.

#### 4. Tool-Use Detection (Soporte JSON Agéntico)
Si el prompt solicita explícitamente formato JSON o llamadas a funciones, el sistema de evaluación cambia dinámicamente de "Análisis de Texto" a "Validación de Schema". Los casos de prueba generados verificarán:
*   Validez sintáctica del JSON.
*   Presencia de campos obligatorios.
*   Tipos de datos correctos.

### ⚡ Eficiencia (Bayesian Early Stopping)

Para optimizar costos y tiempo, el sistema implementa una estrategia de "Early Stopping" basada en Hyperband:

1.  **Prioridad a Edge Cases**: La batalla comienza ejecutando *solo* los escenarios "Edge Case".
2.  **Control de Calidad**: Si el desempeño promedio en estos casos es inferior al **40%**, se asume que los prompts son defectuosos.
3.  **Abortar**: La batalla se detiene inmediatamente ("Pruning"), evitando gastar tokens en los casos "Simple" y "Complex" que no aportarían valor.
