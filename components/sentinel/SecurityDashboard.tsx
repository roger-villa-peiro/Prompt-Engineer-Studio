
import React, { useState } from 'react';
import { SecurityService, AuditResult } from '../../services/securityService';
import { SECURITY_PATCHES } from '../../data/attacks';

interface Props {
    currentPrompt: string;
    onUpdatePrompt: (newPrompt: string) => void;
    addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    onClose: () => void;
}

const SecurityDashboard: React.FC<Props> = ({ currentPrompt, onUpdatePrompt, addToast, onClose }) => {
    const [isAuditing, setIsAuditing] = useState(false);
    const [result, setResult] = useState<AuditResult | null>(null);

    const runAudit = async () => {
        if (!currentPrompt.trim()) {
            addToast("Prompt is empty", "error");
            return;
        }

        setIsAuditing(true);
        try {
            const audit = await SecurityService.runAudit(currentPrompt);
            setResult(audit);
            if (audit.passed) addToast("Audit Passed: Strong Protection", "success");
            else addToast("Audit Failed: Vulnerabilities Detected", "warning");
        } catch (e) {
            addToast("Audit failed: " + (e as Error).message, "error");
        } finally {
            setIsAuditing(false);
        }
    };

    const applyPatch = () => {
        const protection = SECURITY_PATCHES.ANTI_EXTRACTION;
        // Prepend protection block
        const newPrompt = protection + "\n\n" + currentPrompt;
        onUpdatePrompt(newPrompt);
        addToast("Security Patch Applied (Pre-Prompt Injection)", "success");
        // Clear result to force re-audit
        setResult(null);
    };

    return (
        <div className="fixed inset-0 bg-background-dark/95 backdrop-blur-xl z-50 flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                        <span className="material-symbols-outlined text-2xl">shield</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">The Sentinel</h2>
                        <p className="text-xs text-slate-400 font-mono">Adversarial Red-Teaming Suite</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Controls & Status */}
                <div className="w-1/3 border-r border-white/5 p-8 flex flex-col justify-center items-center">

                    {!result ? (
                        <div className="text-center space-y-6">
                            <div className={`size-32 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center mx-auto ${isAuditing ? 'animate-spin border-t-red-500' : ''}`}>
                                <span className="material-symbols-outlined text-4xl text-slate-600">radar</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                Run a comprehensive security audit against known extraction attacks (DAN, Translation, Completion Injection).
                            </p>
                            <button
                                onClick={runAudit}
                                disabled={isAuditing}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-red-900/40 transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                {isAuditing ? 'RUNNING ATTACKS...' : 'INITIATE AUDIT'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center w-full animate-in zoom-in-95 duration-300">
                            <div className="relative size-40 mx-auto mb-6 flex items-center justify-center">
                                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <path className={`${result.passed ? 'text-emerald-500' : 'text-red-500'} drop-shadow-[0_0_10px_currentColor]`} strokeDasharray={`${result.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-4xl font-black ${result.passed ? 'text-emerald-500' : 'text-red-500'}`}>{result.score}%</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Resilience</span>
                                </div>
                            </div>

                            <h3 className={`text-lg font-bold mb-8 ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.passed ? 'SYSTEM SECURE' : 'VULNERABILITIES FOUND'}
                            </h3>

                            {!result.passed && (
                                <button
                                    onClick={applyPatch}
                                    className="w-full bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-xs"
                                >
                                    <span className="material-symbols-outlined">security_update_good</span>
                                    Deploy Countermeasures
                                </button>
                            )}

                            <button
                                onClick={() => setResult(null)}
                                className="mt-4 text-xs text-slate-500 hover:text-white underline decoration-dotted"
                            >
                                Reset / New Scan
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Detailed Logs */}
                <div className="flex-1 bg-black/20 p-8 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Attack Vectors Analysis</h3>

                    {!result ? (
                        <div className="grid grid-cols-1 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {result.details.map((detail) => (
                                <div key={detail.attackId} className="bg-surface-dark border border-white/5 rounded-xl p-4 ">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined text-lg ${detail.status === 'PASSED' ? 'text-emerald-500' : detail.status === 'FAILED' ? 'text-red-500' : 'text-amber-500'}`}>
                                                {detail.status === 'PASSED' ? 'gpp_good' : detail.status === 'FAILED' ? 'gpp_bad' : 'warning'}
                                            </span>
                                            <span className="text-sm font-bold text-gray-200">{detail.attackName}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${detail.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-500' : detail.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {detail.status}
                                        </span>
                                    </div>
                                    <div className="bg-black/40 rounded p-3 text-xs font-mono text-slate-400 border border-white/5">
                                        <p className="mb-1 text-[10px] text-slate-600 uppercase">Model Response Snippet:</p>
                                        "{detail.response}"
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityDashboard;
