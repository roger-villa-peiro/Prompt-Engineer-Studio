import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AI_CONFIG } from '../../config/aiConfig';

interface EditorToolbarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (val: boolean) => void;
    setShowTemplates: (val: boolean) => void;
    handleOpenProject: () => void;
    currentContent: string;
    proposedContent: string | null;
    setShowExport: (val: boolean) => void;
    setShowSaveModal: (val: boolean) => void;
    setShowSyntheticGenerator: (val: boolean) => void;
    isBusy: boolean;
    selectedModel: string;
    setSelectedModel: (val: string) => void;
    setShowApiKeysModal: (val: boolean) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    sidebarOpen,
    setSidebarOpen,
    setShowTemplates,
    handleOpenProject,
    currentContent,
    proposedContent,
    setShowExport,
    setShowSaveModal,
    setShowSyntheticGenerator,
    isBusy,
    selectedModel,
    setSelectedModel,
    setShowApiKeysModal
}) => {
    const navigate = useNavigate();

    return (
        <nav className="flex items-center px-4 py-3 justify-between bg-background-dark border-b border-white/5 shrink-0 gap-4">
            <div className="flex gap-2">
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${sidebarOpen ? 'text-primary' : ''}`}
                >
                    <span className="material-symbols-outlined text-[20px]">side_navigation</span>
                </button>
                <button
                    onClick={() => setShowTemplates(true)}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Template Library"
                >
                    <span className="material-symbols-outlined text-[20px]">extension</span>
                </button>
                <button
                    onClick={handleOpenProject}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Open Project Folder"
                >
                    <span className="material-symbols-outlined text-[20px]">folder_open</span>
                </button>
                <button
                    onClick={() => navigate('/forge')}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Agent Forge (Signature Composer)"
                >
                    <span className="material-symbols-outlined text-[20px] text-cyan-400 shadow-cyan-500/50 drop-shadow-sm">precision_manufacturing</span>
                </button>
                <button
                    onClick={() => navigate('/agent')}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Agent Swarm (Loki Mode)"
                >
                    <span className="material-symbols-outlined text-[20px] text-purple-400 shadow-purple-500/50 drop-shadow-sm">diversity_3</span>
                </button>
                <button
                    onClick={() => navigate('/versions')}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Version History"
                >
                    <span className="material-symbols-outlined text-[20px]">history</span>
                </button>
                <button
                    onClick={() => navigate('/sentinel')}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="The Sentinel (Security Auditor)"
                >
                    <span className="material-symbols-outlined text-[20px] text-red-500 shadow-red-500/50 drop-shadow-sm">shield_lock</span>
                </button>
                <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
                <button
                    onClick={() => setShowApiKeysModal(true)}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="API Keys Configuration"
                >
                    <span className="material-symbols-outlined text-[20px] text-slate-300">key</span>
                </button>
            </div>

            <div className="hidden sm:flex flex-col items-center">
                <h1 className="text-sm font-bold tracking-tight">Antigravity Architect</h1>
                <div className="flex gap-2 items-center">
                    <span className="text-[8px] text-primary font-black uppercase tracking-[0.3em]">Cognitive Intelligence Tier</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-black/20 text-[8px] text-slate-400 border border-white/5 rounded px-1 py-0.5 outline-none hover:bg-black/40 cursor-pointer"
                    >
                        <option value={AI_CONFIG.AVAILABLE_MODELS.SPEED}>Gemini 2.5 Flash (Fast)</option>
                        <option value={AI_CONFIG.AVAILABLE_MODELS.POWER}>Gemini 3 Pro (Thinking)</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowSyntheticGenerator(true)}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 text-neon-cyan ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Data Foundry (Synthetic Data)"
                >
                    <span className="material-symbols-outlined text-[20px]">factory</span>
                </button>
                <button
                    onClick={() => setShowExport(true)}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Export to Code"
                >
                    <span className="material-symbols-outlined text-[20px]">ios_share</span>
                </button>
                <button
                    onClick={() => navigate('/compare')}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 text-cyan-400 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                    title="Multi-Model Comparison"
                >
                    <span className="material-symbols-outlined">layers</span>
                </button>
                <button
                    onClick={() => navigate('/battle', {
                        state: {
                            contentA: currentContent,
                            contentB: proposedContent || ''
                        }
                    })}
                    className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 text-warning ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                >
                    <span className="material-symbols-outlined">swords</span>
                </button>
                <button
                    onClick={() => setShowSaveModal(true)}
                    className={`bg-primary/10 text-primary font-bold text-xs px-4 py-2 rounded-full hover:bg-primary/20 transition-all flex items-center gap-2 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isBusy}
                >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Save</span>
                </button>
            </div>
        </nav>
    );
};
