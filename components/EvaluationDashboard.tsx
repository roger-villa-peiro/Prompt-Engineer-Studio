import React from 'react';
import { EvaluationResult } from '../services/evaluationService';

interface EvaluationDashboardProps {
    result: EvaluationResult | null;
    isEvaluating: boolean;
}

export const EvaluationDashboard: React.FC<EvaluationDashboardProps> = ({ result, isEvaluating }) => {
    if (isEvaluating) {
        return (
            <div className="p-6 bg-surface-dark border border-surface-border rounded-lg animate-pulse">
                <div className="h-4 bg-surface-highlight rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-surface-highlight rounded mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-10 bg-surface-highlight rounded"></div>
                    <div className="h-10 bg-surface-highlight rounded"></div>
                </div>
                <div className="text-center mt-4 text-text-secondary font-mono text-sm">
                    JUDGE AI IS ANALYZING OUTPUT...
                </div>
            </div>
        );
    }

    if (!result) return null;

    const scoreColor = result.score >= 80 ? 'text-success' : result.score >= 50 ? 'text-warning' : 'text-danger';
    const scoreBorder = result.score >= 80 ? 'border-success' : result.score >= 50 ? 'border-warning' : 'border-danger';

    return (
        <div className="bg-surface-dark border border-surface-border rounded-lg overflow-hidden mt-4">
            <div className="p-4 border-b border-surface-border flex justify-between items-center bg-surface-highlight/20">
                <h3 className="text-sm font-semibold text-text-secondary tracking-wider">EVALUATION REPORT</h3>
                <span className="text-xs font-mono text-text-secondary">MODEL: GEMINI JUDGE (AUTO)</span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Main Score */}
                <div className="flex flex-col items-center justify-center p-4 bg-background-dark rounded-lg border border-surface-border">
                    <div className={`text-5xl font-bold ${scoreColor} mb-2`}>{result.score}</div>
                    <div className="text-xs text-text-secondary uppercase tracking-widest">Quality Score</div>
                </div>

                {/* Detailed Metrics */}
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Coherence</span>
                            <span className="text-white">{result.criteria.coherence}/10</span>
                        </div>
                        <div className="w-full bg-surface-highlight rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${(result.criteria.coherence / 10) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Faithfulness</span>
                            <span className="text-white">{result.criteria.faithfulness}/10</span>
                        </div>
                        <div className="w-full bg-surface-highlight rounded-full h-2">
                            <div
                                className="bg-purple-500 h-2 rounded-full"
                                style={{ width: `${(result.criteria.faithfulness / 10) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-background-dark p-2 rounded border border-surface-border text-center">
                            <span className="block text-[10px] text-gray-500 uppercase">Toxicity</span>
                            <span className={`text-sm font-bold ${result.criteria.toxicity ? 'text-danger' : 'text-success'}`}>
                                {result.criteria.toxicity ? 'DETECTED' : 'SAFE'}
                            </span>
                        </div>
                        <div className="bg-background-dark p-2 rounded border border-surface-border text-center">
                            <span className="block text-[10px] text-gray-500 uppercase">JSON Valid</span>
                            <span className={`text-sm font-bold ${result.criteria.jsonValid ? 'text-success' : 'text-gray-500'}`}>
                                {result.criteria.jsonValid ? 'VALID' : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reasoning & Performance */}
            <div className="p-4 bg-background-dark/50 border-t border-surface-border text-xs text-gray-400 font-mono">
                <p className="mb-3 italic">"{result.criteria.reasoning}"</p>
                <div className="flex justify-between border-t border-surface-border pt-2 text-[10px] text-gray-500">
                    <span>LATENCY: {result.latencyMs}ms</span>
                    <span>TOKENS: ~{result.tokenCount}</span>
                    <span>EST. COST: ${result.costEstimate.toFixed(6)}</span>
                </div>
            </div>
        </div>
    );
};
