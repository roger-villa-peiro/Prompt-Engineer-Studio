import React, { useState } from 'react';

interface Props {
    content: string;
    onClose: () => void;
}

type ExportLanguage = 'python' | 'node' | 'json';

export const ExportModal: React.FC<Props> = ({ content, onClose }) => {
    const [language, setLanguage] = useState<ExportLanguage>('python');
    const [copied, setCopied] = useState(false);

    const getCode = () => {
        // Escape standard chars for code strings
        const safeContent = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        switch (language) {
            case 'python':
                return `import openai

client = openai.OpenAI(api_key="YOUR_KEY")

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "${safeContent}"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)`;

            case 'node':
                return `import OpenAI from "openai";

const openai = new OpenAI({ apiKey: 'YOUR_KEY' });

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "${safeContent}" }
    ],
    model: "gpt-4",
  });

  console.log(completion.choices[0].message.content);
}

main();`;

            case 'json':
                return JSON.stringify({
                    prompt: content,
                    metadata: {
                        exported_at: new Date().toISOString(),
                        tool: "Antigravity Architect"
                    }
                }, null, 2);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col">
                <header className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">ios_share</span>
                        Export to Code
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="p-4 flex gap-4 border-b border-white/5 bg-black/20">
                    {(['python', 'node', 'json'] as const).map(lang => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${language === lang ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5'}`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-black/40 min-h-[300px] relative">
                    <textarea
                        readOnly
                        value={getCode()}
                        className="w-full h-full min-h-[300px] bg-transparent text-sm font-mono text-slate-300 outline-none resize-none p-2"
                    />
                    <button
                        onClick={handleCopy}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-white/10"
                    >
                        <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                </div>
            </div>
        </div>
    );
};
