
export type UserInsight = {
  topic: string; // e.g., "Coding Style", "Formatting", "Tone"
  preference: string; // e.g., "Prefers TypeScript over JS", "Strict JSON outputs"
  confidence: number; // 1-100 score of how verified this insight is
};

const STORAGE_KEY = 'antigravity_user_memory';

/**
 * SECOND BRAIN: User Insight Management
 * Persists stylistic and logical preferences learned during interactions.
 */
export class MemoryService {
  /**
   * Retrieves all insights from local storage.
   */
  static getAllInsights(): UserInsight[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Formats insights into a readable block for LLM context injection.
   */
  static getMemoryString(): string {
    const insights = this.getAllInsights();
    if (insights.length === 0) return "No prior preferences recorded.";
    
    return insights
      .sort((a, b) => b.confidence - a.confidence)
      .map(i => `- [${i.topic}]: ${i.preference} (Confidence: ${i.confidence}%)`)
      .join('\n');
  }

  /**
   * Saves or updates insights. If a topic matches, it merges preferences and boosts confidence.
   */
  static saveInsights(newInsights: UserInsight[]) {
    const current = this.getAllInsights();
    
    newInsights.forEach(newItem => {
      const existingIdx = current.findIndex(i => i.topic.toLowerCase() === newItem.topic.toLowerCase());
      
      if (existingIdx > -1) {
        // Simple adaptive learning: update preference and boost confidence
        current[existingIdx].preference = newItem.preference;
        current[existingIdx].confidence = Math.min(100, current[existingIdx].confidence + 15);
      } else {
        current.push({ ...newItem, confidence: 40 }); // Initial confidence
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }

  /**
   * Resets the second brain (Self-curation).
   */
  static clearMemory() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
