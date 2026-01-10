import React, { useMemo } from 'react';

interface Props {
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

// Simple estimate: ~4 chars per token for English text
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export const RichPromptEditor: React.FC<Props> = ({ value, onChange, disabled }) => {
    const tokenCount = useMemo(() => estimateTokens(value), [value]);

    // Color coding for token usage (Assuming 4k context window for "safe" zone basics)
    const tokenColor = tokenCount < 3000 ? 'text-slate-400' : tokenCount < 3800 ? 'text-warning' : 'text-danger';

    // Basic "Highlighting" overlay logic
    // Note: True rich text editing is complex. For now, we use a simple approach:
    // We keep the textarea for input, but we could render a highlighted backdrop if we wanted.
    // However, specifically for this "Quick Win", let's improve the *Stats* and *visuals* around the textarea first,
    // as building a full regex-highlighter that syncs with textarea scroll is error-prone in 5 mins.
    // We will deliver the Token Counter + Variable Detector prominently.

    const variables = useMemo(() => {
        const matches = value.match(/\{\{([^}]+)\}\}/g) || [];
        return Array.from(new Set(matches));
    }, [value]);

    return (
        <div className="flex flex-col h-full relative group">
            {/* Editor Stats Bar */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                {variables.length > 0 && (
                    <div className="bg-background-dark/80 backdrop-blur border border-cyan-500/30 text-cyan-400 text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">data_object</span>
                        {variables.length} VARS
                    </div>
                )}
                <div className={`bg-background-dark/80 backdrop-blur border border-white/10 ${tokenColor} text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1 transition-colors relative`}>
                    <span className="material-symbols-outlined text-[12px]">token</span>
                    {tokenCount} TOKENS
                </div>
            </div>

            {/* Main Textarea with "Pro" styling */}
            <textarea
                className="w-full h-full bg-transparent text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none resize-none p-6 leading-relaxed selection:bg-primary/30"
                placeholder="// Start typing your prompt here...\n// Use {{variable}} for dynamic inputs.\n// Use ### HEADERS for structure."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                disabled={disabled}
            />
        </div>
    );
};
