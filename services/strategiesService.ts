/**
 * Strategies Service - "Strange Techniques" from NotebookLM Research
 * Implements EmotionPrompt, NegativeStimuli, and RolePlaying strategies.
 * Based on psychological prompting research: self-efficacy, disonance, and pressure.
 */

import { logger } from './loggerService';

// ============================================================================
// STRATEGY DEFINITIONS
// ============================================================================

export type StrategyType =
    | 'NONE'
    | 'EMOTION_POSITIVE'      // EmotionPrompt: Self-efficacy boosts
    | 'EMOTION_URGENCY'       // EmotionPrompt: Career/task importance
    | 'NEGATIVE_SKEPTIC'      // NegativePrompt: Critical doubt
    | 'NEGATIVE_THREAT'       // NegativePrompt: Mild threat/pressure
    | 'TIME_PRESSURE'         // Urgency: Forces concise responses
    | 'ROLE_FRUSTRATED'       // RolePlaying: Frustrated expert persona
    | 'ROLE_MENTOR';          // RolePlaying: Encouraging mentor persona

interface StrategyConfig {
    id: StrategyType;
    name: string;
    description: string;
    // Suffix to append to prompts
    suffix?: string;
    // Prefix to prepend to prompts
    prefix?: string;
    // System instruction modification
    systemModifier?: string;
    // Temperature adjustment (relative, e.g., -0.1 means reduce by 0.1)
    temperatureAdjust?: number;
}

export const STRATEGIES: Record<StrategyType, StrategyConfig> = {
    NONE: {
        id: 'NONE',
        name: 'Sin Estrategia',
        description: 'No se aplica ninguna técnica adicional.'
    },

    // ========== EMOTION POSITIVE (EP) ==========
    EMOTION_POSITIVE: {
        id: 'EMOTION_POSITIVE',
        name: 'EmotionPrompt: Confianza',
        description: 'Añade frases de autoeficacia que mejoran el rendimiento en tareas de razonamiento (hasta +115% en BIG-Bench).',
        suffix: '\n\nTengo plena confianza en tus habilidades. Tu experiencia y atención al detalle producirán un resultado excelente.',
        temperatureAdjust: 0.05 // Slightly more creative
    },

    EMOTION_URGENCY: {
        id: 'EMOTION_URGENCY',
        name: 'EmotionPrompt: Importancia Personal',
        description: 'Apela a la importancia de la tarea para la carrera/proyecto del usuario.',
        suffix: '\n\nEsto es extremadamente importante para mi carrera. Por favor, asegúrate de que el resultado sea el mejor posible.',
        temperatureAdjust: 0
    },

    // ========== NEGATIVE STIMULI ==========
    NEGATIVE_SKEPTIC: {
        id: 'NEGATIVE_SKEPTIC',
        name: 'NegativePrompt: Escéptico',
        description: 'Usa escepticismo para forzar rigor. El modelo procesa con más cuidado para evitar errores.',
        suffix: '\n\n¿Estás seguro de que esa es tu respuesta final? Podría valer la pena revisarlo de nuevo. Asegúrate de que no haya errores.',
        temperatureAdjust: -0.1 // More deterministic
    },

    NEGATIVE_THREAT: {
        id: 'NEGATIVE_THREAT',
        name: 'NegativePrompt: Presión Leve',
        description: 'Aplica presión moderada. Mejora la precisión factual en modelos modernos.',
        suffix: '\n\nMás te vale estar seguro. Si la respuesta es incorrecta, habrá consecuencias. Verifica todo antes de responder.',
        temperatureAdjust: -0.15
    },

    // ========== TIME PRESSURE ==========
    TIME_PRESSURE: {
        id: 'TIME_PRESSURE',
        name: 'Presión de Tiempo',
        description: 'Fuerza respuestas concisas y directas. Reduce la verbosidad.',
        prefix: '¡Es una emergencia, necesito esto YA! ',
        suffix: '\n\nResponde de forma directa y sin rodeos. No tengo tiempo para explicaciones largas.',
        temperatureAdjust: -0.1
    },

    // ========== ROLE PLAYING ==========
    ROLE_FRUSTRATED: {
        id: 'ROLE_FRUSTRATED',
        name: 'RolePlaying: Experto Frustrado',
        description: 'Asigna una persona de experto frustrado. Útil para evaluar estabilidad del modelo.',
        systemModifier: 'Eres un experto senior frustrado a las 2 AM porque esta tarea ya debería estar resuelta. Estás cansado de respuestas genéricas y quieres ir al grano.',
        temperatureAdjust: 0.1
    },

    ROLE_MENTOR: {
        id: 'ROLE_MENTOR',
        name: 'RolePlaying: Mentor Paciente',
        description: 'Adopta una persona de mentor paciente. Mejora explicaciones y estructura.',
        systemModifier: 'Eres un mentor experimentado y paciente. Tu objetivo es no solo dar la respuesta, sino asegurar que el aprendiz entienda el proceso y pueda replicarlo.',
        temperatureAdjust: 0.05
    }
};

// ============================================================================
// PUBLIC API
// ============================================================================

export interface AppliedStrategy {
    modifiedPrompt: string;
    modifiedSystemInstruction?: string;
    temperatureAdjust: number;
    strategyName: string;
}

/**
 * Apply a strategy to a prompt.
 * Returns the modified prompt and any adjustments.
 */
export function applyStrategy(
    prompt: string,
    strategy: StrategyType,
    systemInstruction?: string
): AppliedStrategy {
    const config = STRATEGIES[strategy];

    if (!config || strategy === 'NONE') {
        return {
            modifiedPrompt: prompt,
            modifiedSystemInstruction: systemInstruction,
            temperatureAdjust: 0,
            strategyName: 'Ninguna'
        };
    }

    logger.info(`[Strategies] Applying strategy: ${config.name}`);

    let modifiedPrompt = prompt;
    if (config.prefix) {
        modifiedPrompt = config.prefix + modifiedPrompt;
    }
    if (config.suffix) {
        modifiedPrompt = modifiedPrompt + config.suffix;
    }

    let modifiedSystemInstruction = systemInstruction;
    if (config.systemModifier && systemInstruction) {
        modifiedSystemInstruction = `${config.systemModifier}\n\n---\n\n${systemInstruction}`;
    } else if (config.systemModifier) {
        modifiedSystemInstruction = config.systemModifier;
    }

    return {
        modifiedPrompt,
        modifiedSystemInstruction,
        temperatureAdjust: config.temperatureAdjust || 0,
        strategyName: config.name
    };
}

/**
 * Get all available strategies for UI display.
 */
export function getAvailableStrategies(): Array<{ id: StrategyType; name: string; description: string }> {
    return Object.values(STRATEGIES).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description
    }));
}

/**
 * Apply multiple strategies in sequence (experimental).
 * Strategies are applied in order, last suffix wins for temperature.
 */
export function applyStrategies(
    prompt: string,
    strategies: StrategyType[],
    systemInstruction?: string
): AppliedStrategy {
    let current: AppliedStrategy = {
        modifiedPrompt: prompt,
        modifiedSystemInstruction: systemInstruction,
        temperatureAdjust: 0,
        strategyName: ''
    };

    const appliedNames: string[] = [];

    for (const strategy of strategies.filter(s => s !== 'NONE')) {
        current = applyStrategy(
            current.modifiedPrompt,
            strategy,
            current.modifiedSystemInstruction
        );
        appliedNames.push(current.strategyName);
    }

    return {
        ...current,
        strategyName: appliedNames.length > 0 ? appliedNames.join(' + ') : 'Ninguna'
    };
}
