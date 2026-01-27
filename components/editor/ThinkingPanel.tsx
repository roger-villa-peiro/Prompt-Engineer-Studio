import React from 'react';
import { ThinkingViewer } from '../ThinkingViewer';
import { OptimizationResult } from '../../services/schemas';

interface ThinkingPanelProps {
    isOptimizing: boolean;
    progressLog: string[];
    optResult: OptimizationResult | null;
    showReasoning: boolean;
    setShowReasoning: (val: boolean) => void;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
    isOptimizing,
    progressLog,
    optResult,
    showReasoning,
    setShowReasoning
}) => {
    // Show progress indicator if optimizing
    if (isOptimizing && progressLog.length > 0) {
        return (
            <div className="mb-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 px-4">
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <span className="text-xs font-mono text-primary animate-pulse">
                    {progressLog[progressLog.length - 1].replace(/^\[.*?\]\s*/, '')}
                </span>
            </div>
        );
    }

    // Show Reasoning Accordion if we have a result
    if (optResult?.metadata) {
        return (
            <div className="border-t border-white/5 bg-black/20 text-left">
                <button
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                >
                    <span>AI REASONING & LOGIC</span>
                    <span className={`material-symbols-outlined transition-transform ${showReasoning ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {showReasoning && (
                    <div className="p-4 bg-black/40 border-t border-white/5 text-xs text-slate-400 font-mono space-y-2 animate-in slide-in-from-top-2">
                        {optResult.metadata.thinkingProcess && (
                            <ThinkingViewer thinkingProcess={optResult.metadata.thinkingProcess} />
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong className="block text-slate-500 mb-1">SELECTED FRAMEWORK</strong>
                                <span className="text-primary">{optResult.metadata.thinkingProcess ? "Dynamic Chain-of-Thought" : "Standard"}</span>
                            </div>
                            <div>
                                <strong className="block text-slate-500 mb-1">CRITIC SCORE</strong>
                                <span className={optResult.metadata.criticScore > 80 ? 'text-success' : 'text-warning'}>{optResult.metadata.criticScore}/100</span>
                            </div>
                        </div>
                        <div>
                            <strong className="block text-slate-500 mb-1">CHANGES APPLIED</strong>
                            <ul className="list-disc pl-4 space-y-1">
                                {(optResult.metadata.changesMade || []).map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
