
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PromptVersion, BattleResult } from '../types';
import { battlePrompts, runPrompt } from '../services/geminiService';
import { extractVariables } from '../utils/promptUtils';

interface Props {
  versions: PromptVersion[];
  addToast: (text: string, type?: any) => void;
}

const PromptBattle: React.FC<Props> = ({ versions, addToast }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { contentA?: string; contentB?: string } | null;

  const [contentA, setContentA] = useState(state?.contentA || versions[0]?.content || '');
  const [contentB, setContentB] = useState(state?.contentB || versions[1]?.content || versions[0]?.content || '');
  const [isBattling, setIsBattling] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [outputs, setOutputs] = useState<{ A: string, B: string }>({ A: '', B: '' });
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  useEffect(() => {
    const varsA = extractVariables(contentA);
    const varsB = extractVariables(contentB);
    setDetectedVars([...new Set([...varsA, ...varsB])]);
  }, [contentA, contentB]);

  const startBattle = async () => {
    if (!contentA || !contentB) {
      addToast("Both prompts are required", "error");
      return;
    }

    setIsBattling(true);
    setResult(null);

    try {
      const [outA, outB] = await Promise.all([
        runPrompt(contentA, varValues),
        runPrompt(contentB, varValues)
      ]);
      setOutputs({ A: outA, B: outB });

      const contextStr = JSON.stringify(varValues);
      const audit = await battlePrompts(contentA, contentB, contextStr);
      setResult(audit);
      addToast("Audit completed successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Audit process crashed";
      setResult({ winner: 'Tie', reasoning: msg, scoreA: 0, scoreB: 0, error: msg });
      addToast(msg, "error");
    } finally {
      setIsBattling(false);
    }
  };

  const VersionSelector = ({ side, current }: { side: 'A' | 'B', current: string }) => (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-black text-slate-500 uppercase px-2">Prompt {side}</span>
      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto px-1 hide-scrollbar bg-black/20 p-2 rounded-2xl border border-white/5">
        {versions.length === 0 && <p className="text-[10px] text-slate-600 p-3">No history found</p>}
        {versions.map(v => (
          <button
            key={v.id}
            onClick={() => side === 'A' ? setContentA(v.content) : setContentB(v.content)}
            className={`p-3 rounded-xl border text-left transition-all ${(side === 'A' ? contentA : contentB) === v.content
              ? 'bg-primary/20 border-primary'
              : 'bg-white/5 border-transparent hover:border-white/10'
              }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-primary">{v.version}</span>
              {v.rating && <span className="text-[8px] bg-white/10 px-1.5 rounded">★ {v.rating}</span>}
            </div>
            <p className="text-[10px] text-white font-medium line-clamp-1">{v.message}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background-dark overflow-hidden">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background-dark/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="size-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-base font-bold">Battle Arena</h2>
            <p className="text-[9px] text-primary font-bold uppercase tracking-[0.2em]">Intelligence Benchmarking</p>
          </div>
        </div>

        <button
          onClick={startBattle}
          disabled={isBattling}
          className="bg-primary text-white font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
        >
          <span className="material-symbols-outlined text-[20px]">{isBattling ? 'sync' : 'gavel'}</span>
          {isBattling ? 'Analyzing Architecture...' : 'Trigger Audit'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 pb-32 hide-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <VersionSelector side="A" current={contentA} />
          <VersionSelector side="B" current={contentB} />
        </div>

        {detectedVars.length > 0 && (
          <div className="bg-surface-dark p-6 rounded-3xl border border-white/5 shadow-2xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Global Test Variables</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedVars.map(v => (
                <div key={v} className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-primary ml-1 uppercase">{v}</label>
                  <textarea
                    value={varValues[v] || ""}
                    onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                    placeholder={`Insert data for {{${v}}}...`}
                    className="bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-primary/50 resize-none h-24 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <textarea
            value={contentA} onChange={(e) => setContentA(e.target.value)}
            className="w-full h-80 bg-surface-dark border border-white/5 rounded-3xl p-6 text-xs font-mono text-slate-200 outline-none focus:border-primary/40 resize-none"
            placeholder="Architecture A..."
          />
          <textarea
            value={contentB} onChange={(e) => setContentB(e.target.value)}
            className="w-full h-80 bg-surface-dark border border-white/5 rounded-3xl p-6 text-xs font-mono text-slate-200 outline-none focus:border-primary/40 resize-none"
            placeholder="Architecture B..."
          />
        </div>

        {outputs.A && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-black/30 p-5 rounded-2xl border border-white/5 text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
              <span className="text-[8px] font-black text-slate-600 block mb-2 uppercase">Synthesized Output A</span>
              {outputs.A}
            </div>
            <div className="bg-black/30 p-5 rounded-2xl border border-white/5 text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
              <span className="text-[8px] font-black text-slate-600 block mb-2 uppercase">Synthesized Output B</span>
              {outputs.B}
            </div>
          </div>
        )}

        {result && (
          <div className={`p-8 rounded-[2.5rem] border animate-in zoom-in-95 ${result.error ? 'bg-danger/5 border-danger/20' : 'bg-surface-dark border-white/10'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-4xl ${result.error ? 'text-danger' : 'text-primary'}`}>
                  {result.error ? 'report' : 'verified_user'}
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Structural Audit Verdict</h3>
                  <p className="text-[10px] text-slate-500">Impartial Quality Analysis</p>
                </div>
              </div>
              {!result.error && (
                <div className="flex gap-10 items-center">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-tighter">Score A</span>
                    <span className={`text-3xl font-black ${result.scoreA >= result.scoreB ? 'text-primary' : 'text-slate-400'}`}>{result.scoreA}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-tighter">Score B</span>
                    <span className={`text-3xl font-black ${result.scoreB >= result.scoreA ? 'text-primary' : 'text-slate-400'}`}>{result.scoreB}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-6 rounded-2xl border ${result.error ? 'bg-black/20 border-danger/30' : 'bg-black/30 border-white/5'}`}>
              <p className={`text-xs leading-relaxed italic ${result.error ? 'text-danger font-mono' : 'text-slate-300'}`}>
                {result.reasoning}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptBattle;
