import React, { useState } from 'react';
import { callGemini } from '../services/aiTransport';
import { SyntheticDataResponse } from '../services/schemas';
import { supabase } from '../src/services/supabaseClient';

interface Props {
    onClose?: () => void;
    addToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

const SyntheticGenerator: React.FC<Props> = ({ onClose, addToast }) => {
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<SyntheticDataResponse | null>(null);

    const handleGenerate = async () => {
        if (!topic) return;
        setIsGenerating(true);
        setResult(null);

        const prompt = `
            Act as a Lead QA Engineer. Generate a synthetic dataset for testing a prompt about: "${topic}".
            
            Generate strict JSON matching this schema:
            {
                "dataset_name": "string",
                "description": "string",
                "cases": [
                    {
                        "id": "unique_id",
                        "input": "The user input string",
                        "context": "Any background context if needed (optional)",
                        "expected_behavior": "What the model SHOULD do",
                        "difficulty": "easy" | "medium" | "hard" | "edge_case"
                    }
                ]
            }

            Generate exactly ${count} diverse cases defined by strict JSON.
            Include at least one "edge_case".
            Do not include markdown formatting.
        `;

        try {
            const responseText = await callGemini({
                prompt,
                jsonMode: true,
                temperature: 0.8 // High creativity for diverse data
            });

            // Clean markdown code blocks if present (common issue)
            const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleaned) as SyntheticDataResponse;

            setResult(data);
            addToast('Dataset generated successfully', 'success');

        } catch (err: any) {
            console.error(err);
            addToast('Generation failed: ' + err.message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!result) return;
        // In a real app we would save to Supabase here. 
        // For now we just stringify to clipboard or mock save.
        try {
            await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
            addToast('JSON copied to clipboard', 'success');
        } catch (e) {
            addToast('Failed to copy', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full p-6 space-y-6 animate-enter">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-display font-bold text-white neon-text">Data Foundry</h2>
                    <p className="text-text-secondary text-sm">Generate synthetic test cases for your prompt.</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-text-tertiary hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            <div className="glass-panel p-6 rounded-xl space-y-4 border-l-4 border-l-primary/50">
                <div className="space-y-2">
                    <label className="text-xs font-mono text-primary-glow uppercase tracking-wider">Topic / Persona</label>
                    <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="E.g. A customer service agent handling angry refunds..."
                        className="w-full bg-background-dark/50 border border-white/10 rounded-lg p-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all h-24 resize-none"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="space-y-2 flex-1">
                        <label className="text-xs font-mono text-primary-glow uppercase tracking-wider">Count: {count}</label>
                        <input
                            type="range" min="3" max="20" step="1"
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            className="w-full accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${isGenerating ? 'bg-white/5 cursor-wait' : 'bg-primary hover:bg-primary-dark shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                                <span>Forging...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl">auto_fix_high</span>
                                <span>Generate</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results View */}
            {result && (
                <div className="flex-1 overflow-hidden flex flex-col glass-panel rounded-xl animate-enter">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h3 className="font-mono text-sm text-neon-cyan">{result.dataset_name}</h3>
                        <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 bg-white/5 rounded text-text-tertiary">{result.cases.length} cases</span>
                            <button onClick={handleSave} className="text-xs flex items-center gap-1 hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-sm">content_copy</span> Copy
                            </button>
                        </div>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-3 hide-scrollbar">
                        {result.cases.map((c, i) => (
                            <div key={i} className="p-4 rounded border border-white/5 bg-background-dark/30 hover:border-primary/30 transition-colors group">
                                <div className="flex justify-between mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wide ${c.difficulty === 'edge_case' ? 'bg-danger/20 text-danger' :
                                            c.difficulty === 'hard' ? 'bg-warning/20 text-warning' :
                                                'bg-success/20 text-success'
                                        }`}>{c.difficulty}</span>
                                    <span className="text-xs text-text-tertiary font-mono">ID: {c.id}</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-text-tertiary block text-xs mb-1">Input:</span>
                                        <p className="text-white font-mono bg-black/20 p-2 rounded">{c.input}</p>
                                    </div>
                                    <div className="pl-4 border-l-2 border-primary/20">
                                        <span className="text-text-tertiary block text-xs mb-1">Expected:</span>
                                        <p className="text-text-secondary">{c.expected_behavior}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyntheticGenerator;
