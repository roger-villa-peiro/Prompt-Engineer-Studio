import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AIService, ModelProvider } from '../services/aiService';

const ALL_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', provider: 'gemini' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', provider: 'gemini' },
    { id: 'gpt-4o', name: 'GPT-4o (Simulated)', provider: 'openai' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Simulated)', provider: 'anthropic' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' },
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Groq)', provider: 'groq' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (Groq)', provider: 'groq' },
];

// Models are now managed by the backend proxy. We assume they are available or the proxy will return an error.
const AVAILABLE_MODELS = ALL_MODELS;

export const ComparisonView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const initialPrompt = location.state?.content || '';

    const [prompt, setPrompt] = useState(initialPrompt);

    // Left Panel State
    const [modelA, setModelA] = useState(AVAILABLE_MODELS.length > 0 ? AVAILABLE_MODELS[0].id : '');
    const [outputA, setOutputA] = useState('');
    const [loadingA, setLoadingA] = useState(false);
    const [statsA, setStatsA] = useState<{ latency: number } | null>(null);

    // Right Panel State
    const [modelB, setModelB] = useState(AVAILABLE_MODELS.length > 1 ? AVAILABLE_MODELS[1].id : (AVAILABLE_MODELS.length > 0 ? AVAILABLE_MODELS[0].id : ''));
    const [outputB, setOutputB] = useState('');
    const [loadingB, setLoadingB] = useState(false);
    const [statsB, setStatsB] = useState<{ latency: number } | null>(null);

    const handleRun = async () => {
        if (!prompt.trim()) return;

        // Trigger A
        setLoadingA(true);
        const configA = AVAILABLE_MODELS.find(m => m.id === modelA)!;
        AIService.generate(prompt, configA.provider as ModelProvider, configA.id)
            .then(res => {
                setOutputA(res.text);
                setStatsA({ latency: res.latency });
            })
            .finally(() => setLoadingA(false));

        // Trigger B
        setLoadingB(true);
        const configB = AVAILABLE_MODELS.find(m => m.id === modelB)!;
        AIService.generate(prompt, configB.provider as ModelProvider, configB.id)
            .then(res => {
                setOutputB(res.text);
                setStatsB({ latency: res.latency });
            })
            .finally(() => setLoadingB(false));
    };

    return (
        <div className="flex flex-col h-screen bg-background-dark text-white overflow-hidden">
            {/* Header */}
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-surface-dark">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="hover:bg-white/10 p-2 rounded-full">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="font-bold text-sm tracking-widest uppercase">Multi-Model Arena</h1>
                </div>
                <button
                    onClick={handleRun}
                    disabled={loadingA || loadingB}
                    className="bg-primary hover:bg-primary-dark px-6 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Run Comparison
                </button>
            </div>

            {/* Prompt Input (Shared) */}
            <div className="p-4 border-b border-white/5 bg-background-dark/50">
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-4 text-sm font-mono h-24 outline-none focus:border-primary/50 resize-none"
                        placeholder="Enter prompt to compare..."
                    />
                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 font-mono">
                        SHARED INPUT
                    </div>
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Panel A */}
                <div className="flex-1 border-r border-white/5 flex flex-col min-w-0">
                    <div className="p-3 border-b border-white/5 bg-surface-dark/30 flex justify-between items-center">
                        <select
                            value={modelA}
                            onChange={(e) => setModelA(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs font-bold text-primary outline-none"
                        >
                            {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {statsA && <span className="text-[10px] text-slate-500">{statsA.latency}ms</span>}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-slate-300">
                        {loadingA ? (
                            <div className="flex flex-col items-center justify-center h-full text-primary animate-pulse">
                                <span className="material-symbols-outlined text-4xl mb-2">neurology</span>
                                <span className="text-xs uppercase font-black">Generating...</span>
                            </div>
                        ) : outputA || <span className="text-slate-600 italic">Ready to run.</span>}
                    </div>
                </div>

                {/* Panel B */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-3 border-b border-white/5 bg-surface-dark/30 flex justify-between items-center">
                        <select
                            value={modelB}
                            onChange={(e) => setModelB(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs font-bold text-warning outline-none"
                        >
                            {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {statsB && <span className="text-[10px] text-slate-500">{statsB.latency}ms</span>}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-slate-300">
                        {loadingB ? (
                            <div className="flex flex-col items-center justify-center h-full text-warning animate-pulse">
                                <span className="material-symbols-outlined text-4xl mb-2">neurology</span>
                                <span className="text-xs uppercase font-black">Generating...</span>
                            </div>
                        ) : outputB || <span className="text-slate-600 italic">Ready to run.</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
