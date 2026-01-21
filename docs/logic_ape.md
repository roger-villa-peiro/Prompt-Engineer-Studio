# APE 2.0: Unity Evolution Module

## 🧬 Concepto (The Evolutionary Biologist)

APE 2.0 ("Unity Engine") abandona la búsqueda aleatoria por una síntesis dirigida. El objetivo no es probar variantes al azar, sino **construir científicamente la mejor versión posible** (Master Mutation) basándose en la evidencia empírica de las batallas.

### Core Mechanics

#### 1. Unity Evolution (Master Mutation)
En lugar de generar multiversos (Beam Search), el Biólogo concentra todo su poder de cómputo en generar **una única variante superior**.
*   **Input**: Toma el ganador actual + el feedback del juez + los casos de error.
*   **Proceso**: Sintetiza Mejoras Estructurales, Cognitivas y de Contenido en una sola pasada.
*   **Resultado**: Un prompt que soluciona *todos* los problemas detectados simultáneamente.

#### 2. Convergence Check (Detección de Optimalidad)
El sistema es capaz de detectar cuando un prompt ha alcanzado su pico local.
*   Si la "Master Mutation" generada es semánticamente idéntica al ganador actual:
    *   **Acción**: Se detiene la evolución.
    *   **Feedback**: "Ya tienes el prompt óptimo. No se encontraron mejoras significativas."
    *   **Beneficio**: Ahorra tokens y evita ciclos infinitos de cambios irrelevantes.

#### 3. Deep Reasoning (Lógica en Español)
El motor de evolución (impulsado por Gemini 3 Pro) genera un **meta-razonamiento en Español** antes de escribir el prompt. Este texto explica *por qué* se hacen los cambios (ej: "Se añadieron restricciones XML para evitar alucinaciones en los casos edge").

#### 4. The Cluely Brake (Freno de Incertidumbre)
**Regla del 90%**: Antes de generar la `Master Mutation`, el Biólogo evalúa:
*"¿Estoy 90% seguro de que este cambio mejorará el Score?"*
*   Si **NO**: Detiene la mutación (Status `CONVERGED`).
*   Si **SÍ**: Procede (Status `EVOLVING`).
*   **Beneficio**: Evita el "Over-optimization" y la degradación de prompts que ya funcionan bien.

## 🔄 El Ciclo de Vida Evolutivo

1.  **Battle (SIPDO)**: Ejecución de tests y evaluación Dual-Judge.
2.  **Pressure**: Se identifican los puntos débiles del ganador (Score < 100).
3.  **Synthesis**: El Biólogo crea la `Master Mutation`.
4.  **Convergence**: Se verifica si la mutación aporta valor real.
5.  **Re-Battle**: Si es válida, la nueva versión desafía al campeón anterior.
