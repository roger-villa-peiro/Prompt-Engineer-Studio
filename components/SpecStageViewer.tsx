import React, { useState } from 'react';
import { OptimizationResult } from '../services/geminiService';

const SpecStageViewer: React.FC<{
    result: OptimizationResult;
    onAdvance: (input: string) => void;
    isBusy: boolean;
}> = ({ result, onAdvance, isBusy }) => {
    const [input, setInput] = useState('');
    const stage = result.specStage;
    const artifacts = result.artifacts;

    return (
        <div className="flex flex-col h-full bg-surface-dark border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {/* HEADER */}
            <div className="bg-black/20 p-4 border-b border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                        <span className="material-symbols-outlined">psychology</span>
                        Spec Architect Flow
                    </span>
                    <div className="flex gap-1">
                        {['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].map((s, i) => {
                            const currentIdx = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].indexOf(stage || '');
                            const mapIdx = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].indexOf(s);
                            return (
                                <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${mapIdx <= currentIdx ? 'bg-primary' : 'bg-white/10'}`} />
                            )
                        })}
                    </div>
                </div>
                <div className="text-xl font-bold text-white">
                    {stage === 'REQUIREMENTS' && "Requirements Gathering"}
                    {stage === 'DESIGN' && "System Architecture"}
                    {stage === 'TASKS' && "Execution Plan"}
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {stage === 'REQUIREMENTS' && artifacts?.requirements && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                            <h3 className="text-sm font-bold text-primary mb-2">CLARIFICATION NEEDED</h3>
                            <p className="text-slate-300 text-sm mb-4">{artifacts.requirements.thought_process}</p>
                            <ul className="space-y-2">
                                {artifacts.requirements.questions.map((q, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-white">
                                        <span className="text-primary font-bold">{i + 1}.</span>
                                        {q}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Your Answers</label>
                            <textarea
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 min-h-[150px]"
                                placeholder="Answer the questions here to proceed to design..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {stage === 'DESIGN' && artifacts?.design && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="p-4 bg-surface-dark border border-white/5 rounded-xl">
                            <code className="text-xs font-mono text-cyan-400 block whitespace-pre-wrap">
                                {artifacts.design.mermaid_diagram}
                            </code>
                        </div>
                        <div className="p-4 bg-surface-dark border border-white/5 rounded-xl">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Data Structure</h4>
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{artifacts.design.data_models}</pre>
                        </div>
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <p className="text-sm text-purple-200">Review the design above. Use the chat to request changes, or click approve to generate tasks.</p>
                        </div>
                    </div>
                )}

                {stage === 'TASKS' && artifacts?.tasks && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        {artifacts.tasks.tasks.map(t => (
                            <div key={t.id} className="p-4 bg-surface-dark border border-white/5 rounded-xl flex gap-3">
                                <div className="size-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-500">{t.id}</div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">{t.title}</h4>
                                    <ul className="mt-2 text-xs text-slate-400 space-y-1 list-disc pl-4">
                                        {t.steps.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                <button className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white" disabled={isBusy}>
                    Request Changes
                </button>
                <button
                    className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                    onClick={() => onAdvance(input || "Approved")}
                    disabled={isBusy || (stage === 'REQUIREMENTS' && !input.trim())}
                >
                    {isBusy ? 'Thinking...' : (stage === 'TASKS' ? 'Finalize' : 'Proceed')}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};

export default SpecStageViewer;
