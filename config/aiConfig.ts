
export const AI_CONFIG = {
  MODEL_ID: 'gemini-3-pro-preview',
  MAX_RETRIES: 3,
  MIN_QUALITY_SCORE: 80,
  GENERATION_CONFIG: {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
  }
} as const;
