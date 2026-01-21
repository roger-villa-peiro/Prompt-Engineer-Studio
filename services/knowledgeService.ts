/**
 * KNOWLEDGE SERVICE
 * Simulates a Parallel RAG / Search Retrieval System.
 * In production, this would call Tavily, Perplexity, or a Vector DB.
 * For this demo, we use a "Hardcoded Knowledge Graph" for common tech topics.
 */

export interface KnowledgeSnippet {
    source: string;
    content: string;
    reliability: number; // 0-1
}

const KNOWLEDGE_GRAPH: Record<string, string> = {
    "react": "React 19 introduces the Compiler (auto-memoization) and Actions (useActionState). Derived state should be calculated during render. Use 'use' hook for promises.",
    "next": "Next.js 15 uses App Router by default. Server Actions are stable. Middleware is used for auth. 'use client' directive is mandatory for interactivity.",
    "tailwind": "Tailwind v4 is in beta. For v3, use 'class-variance-authority' (cva) for component variants. 'cn' utility is standard for class merging.",
    "ai": "Gemini 1.5 Pro features a 2M token window. It supports native audio/video understanding. Thinking/Reasoning models require specific XML <thinking> tags.",
    "auth": "Supabase Auth Helpers are deprecated; use @supabase/ssr. Auth.js v5 is the new standard for NextAuth.",
    "zustand": "Zustand v5 requires 'useShallow' for optimizing selectors."
};

export const searchKnowledge = async (query: string): Promise<KnowledgeSnippet[]> => {
    // Simulate network latency (Parallel execution test)
    await new Promise(resolve => setTimeout(resolve, 800));

    const lowerQuery = query.toLowerCase();
    const results: KnowledgeSnippet[] = [];

    // Semantic search simulation
    Object.keys(KNOWLEDGE_GRAPH).forEach(key => {
        if (lowerQuery.includes(key)) {
            results.push({
                source: `Official Docs (${key})`,
                content: KNOWLEDGE_GRAPH[key],
                reliability: 0.95
            });
        }
    });

    if (results.length === 0 && lowerQuery.includes("code")) {
        // Default coding fallback
        results.push({
            source: "General Coding Best Practices",
            content: "Prefer functional programming. Use immutable patterns. clean code principles apply.",
            reliability: 0.8
        });
    }

    return results;
};

export const formatKnowledgeContext = (snippets: KnowledgeSnippet[]): string => {
    if (snippets.length === 0) return "";

    return `
  [RETRIEVED KNOWLEDGE]
  ${snippets.map(s => `- [${s.source}]: ${s.content}`).join('\n')}
  `.trim();
};
