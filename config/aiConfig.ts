
export const AI_CONFIG = {
  MODEL_ID: 'gemini-3-flash-preview', // Verified working model for this key
  AVAILABLE_MODELS: {
    POWER: 'gemini-3.1-pro-preview', // Gemini 3.1 Pro Preview
    SPEED: 'gemini-3-flash-preview',
    IMAGE: 'gemini-3-flash-preview' // Fallback for now
  },
  MAX_RETRIES: 2, // Reduced for faster Refine execution
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
