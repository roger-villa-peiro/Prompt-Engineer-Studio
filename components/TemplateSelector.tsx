import React, { useState } from 'react';

import { ADVANCED_TEMPLATES } from '../data/templates';

const TEMPLATES = [
    ...ADVANCED_TEMPLATES.map((t: any) => ({
        id: t.id,
        category: t.category,
        title: t.name,
        description: t.description,
        content: t.content
    })),
    {
        id: 'code-gen',
        category: 'Development',
        title: 'Senior Code Architect',
        description: 'Generates production-ready code with error handling and types.',
        content: "### ROLE\nYou are a Senior Software Architect specializing in [LANGUAGE]. Your code must be robust, scalable, and follow SOLID principles.\n\n### TASK\nImplement a [FUNCTIONALITY] that meets the following requirements:\n1. Use strict typing.\n2. Handle edge cases (network errors, invalid input).\n3. Include extensive JSDoc/Comments.\n\n### FORMAT\nReturn only the code block with no conversational filler."
    },
    {
        id: 'data-analysis',
        category: 'Data Science',
        title: 'Insight Extractor',
        description: 'Analyzes raw data sets to find trends and anomalies.',
        content: "### ROLE\nYou are a Data Science Expert. I will provide raw data in [FORMAT].\n\n### TASK\n1. Identify key trends.\n2. Highlight statistical anomalies.\n3. Suggest 3 actionable business insights.\n\n### CONSTRAINTS\n- Be concise.\n- Use bullet points.\n- Back up claims with data percentages."
    },
    {
        id: 'creative-writing',
        category: 'Content',
        title: 'Viral Hook Generator',
        description: 'Creates engaging social media hooks using psychological triggers.',
        content: "### ROLE\nYou are a Viral Marketing Specialist using the AIDA framework (Attention, Interest, Desire, Action).\n\n### TASK\nWrite 5 variations of a LinkedIn hook for a post about [TOPIC].\n\n### STYLE\n- Punchy, controversial, or surprising.\n- Under 50 words each.\n- Use spacing for readability."
    }
];

interface Props {
    onSelect: (content: string) => void;
    onClose: () => void;
}

export const TemplateSelector: React.FC<Props> = ({ onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <header className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Template Library</h2>
                        <p className="text-xs text-slate-400">Bootstrap your prompt with industry-standard architectures.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { onSelect(t.content); onClose(); }}
                            className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/50 p-4 rounded-xl text-left transition-all group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-widest">{t.category}</span>
                                <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors text-sm">download</span>
                            </div>
                            <h3 className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{t.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
