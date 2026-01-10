import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShareService } from '../services/shareService';
import { PromptVersion } from '../types';

export const SharedPromptView: React.FC<{ onFork: (content: string) => void }> = ({ onFork }) => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState<PromptVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        ShareService.getSharedPrompt(token)
            .then(p => {
                if (!p) setError('Prompt not found or access denied.');
                else setPrompt(p);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [token]);

    const handleFork = () => {
        if (prompt) {
            onFork(prompt.content);
            navigate('/');
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background-dark text-primary">
                <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
            </div>
        );
    }

    if (error || !prompt) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-background-dark text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-4">cloud_off</span>
                <h1 className="text-xl font-bold text-white mb-2">Prompt Not Found</h1>
                <p className="mb-6">{error || "This link might be invalid or expired."}</p>
                <button onClick={() => navigate('/')} className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20">
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen bg-background-dark text-white flex flex-col">
            <header className="h-16 border-b border-white/5 bg-surface-dark flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <div className="bg-cyan-500/20 text-cyan-400 p-2 rounded-lg">
                        <span className="material-symbols-outlined">public</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm uppercase tracking-widest">{prompt.message}</h1>
                        <p className="text-[10px] text-slate-500">Shared by {prompt.author} • {new Date(prompt.timestamp).toLocaleDateString()}</p>
                    </div>
                </div>
                <button
                    onClick={handleFork}
                    className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">fork_right</span>
                    Fork Copy
                </button>
            </header>

            <main className="flex-1 overflow-hidden p-6 max-w-4xl mx-auto w-full">
                <div className="bg-surface-dark border border-white/5 rounded-2xl p-6 h-full flex flex-col shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-cyan-500"></div>
                    <pre className="flex-1 font-mono text-sm text-slate-300 whitespace-pre-wrap overflow-y-auto outline-none">
                        {prompt.content}
                    </pre>
                </div>
            </main>
        </div>
    );
};
