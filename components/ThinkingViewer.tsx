import React, { useState } from 'react';

interface ThinkingViewerProps {
    thinkingProcess: string;
    isCollapsed?: boolean;
}

export function ThinkingViewer({ thinkingProcess, isCollapsed = false }: ThinkingViewerProps) {
    const [isOpen, setIsOpen] = useState(!isCollapsed);

    if (!thinkingProcess) return null;

    // Parse specific thinking tags if present
    const planMatch = thinkingProcess.match(/<thinking type="plan">([\s\S]*?)<\/thinking>/);
    const ruminateMatch = thinkingProcess.match(/<thinking type="ruminate">([\s\S]*?)<\/thinking>/);

    const hasTags = planMatch || ruminateMatch;

    return (
        <div className="w-full my-4 border border-purple-500/30 rounded-lg bg-slate-900/50 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 flex items-center justify-between text-xs font-mono text-purple-300 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <span className="font-bold">METACOGNITION LAYER</span>
                    {hasTags && <span className="px-2 py-0.5 bg-purple-500/20 rounded text-[10px]">Unicorn Standard v3</span>}
                </div>
                <span>{isOpen ? 'Hide' : 'Show'} Trace</span>
            </button>

            {isOpen && (
                <div className="p-4 text-sm font-mono text-slate-300 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {hasTags ? (
                        <>
                            {ruminateMatch && (
                                <div className="space-y-1">
                                    <div className="text-xs text-yellow-500 font-bold uppercase tracking-wider">Rumingation (Deep Dive)</div>
                                    <div className="pl-3 border-l-2 border-yellow-500/20 whitespace-pre-wrap">
                                        {ruminateMatch[1].trim()}
                                    </div>
                                </div>
                            )}
                            {planMatch && (
                                <div className="space-y-1">
                                    <div className="text-xs text-green-500 font-bold uppercase tracking-wider">Strategic Plan</div>
                                    <div className="pl-3 border-l-2 border-green-500/20 whitespace-pre-wrap">
                                        {planMatch[1].trim()}
                                    </div>
                                </div>
                            )}
                            {!planMatch && !ruminateMatch && (
                                <div className="whitespace-pre-wrap">{thinkingProcess}</div>
                            )}
                        </>
                    ) : (
                        <div className="whitespace-pre-wrap opacity-80 italic">
                            {thinkingProcess}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
