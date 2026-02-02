
export const AI_CONFIG = {
  MODEL_ID: 'gemini-2.5-flash', // Verified working model
  AVAILABLE_MODELS: {
    POWER: 'gemini-3-pro-preview',
    SPEED: 'gemini-2.5-flash' // Verified: Available and fast
  },
  MAX_RETRIES: 3,
  MIN_QUALITY_SCORE: 80,
  GENERATION_CONFIG: {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
  }
} as const;

export const FACTUAL_MODE = {
  temperature: 0.1,
  requireCitations: true,
  systemSuffix: '\n\nIMPORTANT: If you are not 100% certain, respond with "No tengo información suficiente para responder con certeza."'
};
