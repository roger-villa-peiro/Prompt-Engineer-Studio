import React, { useState, useEffect } from 'react';

interface Props {
    onClose: () => void;
}

export const ApiKeysModal: React.FC<Props> = ({ onClose }) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [groqKey, setGroqKey] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const storedGemini = localStorage.getItem('antigravity_gemini_key') || '';
        const storedGroq = localStorage.getItem('antigravity_groq_key') || '';
        setGeminiKey(storedGemini);
        setGroqKey(storedGroq);
    }, []);

    const handleSave = () => {
        if (geminiKey.trim()) {
            localStorage.setItem('antigravity_gemini_key', geminiKey.trim());
        } else {
            localStorage.removeItem('antigravity_gemini_key');
        }

        if (groqKey.trim()) {
            localStorage.setItem('antigravity_groq_key', groqKey.trim());
        } else {
            localStorage.removeItem('antigravity_groq_key');
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setTimeout(() => onClose(), 1000);
    };

    const handleClear = () => {
        setGeminiKey('');
        setGroqKey('');
        localStorage.removeItem('antigravity_gemini_key');
        localStorage.removeItem('antigravity_groq_key');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <header className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">key</span>
                        API Keys Configuration
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="p-6 flex flex-col gap-6 bg-black/20">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        />
                        <p className="text-[10px] text-slate-500">Required for primary operations and metacognitive refinements.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            Groq API Key
                        </label>
                        <input
                            type="password"
                            value={groqKey}
                            onChange={(e) => setGroqKey(e.target.value)}
                            placeholder="gsk_..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                        />
                        <p className="text-[10px] text-slate-500">Required for Agent Forge and specific testing functions.</p>
                    </div>

                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex gap-3 items-start">
                        <span className="material-symbols-outlined text-warning text-sm mt-0.5">shield</span>
                        <p className="text-xs text-warning/90 leading-relaxed">
                            Keys are stored securely in your browser's local storage and are only sent directly to the proxy to authenticate your requests. They are never logged or stored on our servers.
                        </p>
                    </div>
                </div>

                <footer className="p-4 border-t border-white/5 flex justify-between items-center bg-surface-dark rounded-b-2xl">
                    <button
                        onClick={handleClear}
                        className="text-xs font-bold text-danger/70 hover:text-danger transition-colors px-3 py-2"
                    >
                        Clear Keys
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                        >
                            {saved ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    Saved
                                </>
                            ) : (
                                'Save Keys'
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
