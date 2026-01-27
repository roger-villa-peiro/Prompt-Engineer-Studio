import React from 'react';

const DiffView: React.FC<{ original: string; modified: string }> = ({ original, modified }) => {
    if (original.length > 20000 || modified.length > 20000) {
        return (
            <div className="flex h-full gap-4 p-4 text-slate-500 font-mono text-xs">
                <div className="flex-1 overflow-auto border p-2 border-danger/20 rounded">
                    <div className="font-bold mb-2 text-danger">ORIGINAL</div>
                    <pre>{original}</pre>
                </div>
                <div className="flex-1 overflow-auto border p-2 border-success/20 rounded">
                    <div className="font-bold mb-2 text-success">PROPOSED</div>
                    <pre>{modified}</pre>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4 h-full p-4 bg-background-dark/50">
            <div className="flex-1 flex flex-col min-h-0">
                <span className="text-[10px] font-black uppercase text-danger/50 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Original Version
                </span>
                <div className="flex-1 bg-surface-dark border-l-2 border-danger/20 rounded-r-xl p-4 text-sm font-mono text-slate-400 overflow-y-auto whitespace-pre-wrap break-words break-all opacity-80 shadow-inner">
                    {original}
                </div>
            </div>

            <div className="hidden sm:flex flex-col justify-center text-primary/20">
                <span className="material-symbols-outlined text-3xl">arrow_forward</span>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <span className="text-[10px] font-black uppercase text-success/50 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Optimized Proposal
                </span>
                <div className="flex-1 bg-surface-dark border-l-2 border-success/40 rounded-r-xl p-4 text-sm font-mono text-success/90 overflow-y-auto whitespace-pre-wrap break-words break-all shadow-inner ring-1 ring-success/5">
                    {modified}
                </div>
            </div>
        </div>
    );
};

export default DiffView;
