
export const AI_CONFIG = {
  MODEL_ID: 'gemini-3-pro-preview', // Default powerhouse
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
