
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TestCase } from '../types';

const EvaluationResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const results: TestCase[] = location.state?.results || [];

  if (results.length === 0) return null;

  const avgFaithfulness = (results.reduce((acc, r) => acc + (r.metrics?.faithfulness || 0), 0) / results.length).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-background-dark">
      <header className="p-4 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => navigate('/')} className="size-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h2 className="text-base font-bold">Benchmark Results</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Architectural Scorecard</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24 scroll-smooth hide-scrollbar">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface-dark rounded-2xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Faithfulness</span>
            <p className="text-3xl font-black text-green-400 mt-1">{avgFaithfulness}/5</p>
            <div className="mt-2 w-full bg-white/5 h-1 rounded-full overflow-hidden">
               <div className="bg-green-400 h-full" style={{ width: `${(Number(avgFaithfulness)/5)*100}%` }}></div>
            </div>
          </div>
          <div className="p-4 bg-surface-dark rounded-2xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Pass Rate</span>
            <p className="text-3xl font-black text-primary mt-1">
              {Math.round((results.filter(r => (r.metrics?.faithfulness || 0) >= 4).length / results.length) * 100)}%
            </p>
          </div>
        </div>

        {/* Detailed Results */}
        {results.map((res) => (
          <div key={res.id} className="bg-surface-dark rounded-3xl border border-white/5 overflow-hidden">
            <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/5">
              <span className="text-[10px] font-mono text-slate-500">CASE ID: {res.id.slice(0, 4)}</span>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase">Fidelidad</p>
                  <p className={`text-sm font-black ${res.metrics?.faithfulness! >= 4 ? 'text-green-400' : 'text-danger'}`}>{res.metrics?.faithfulness}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase">Relevancia</p>
                  <p className="text-sm font-black text-white">{res.metrics?.relevance}/5</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Input</span>
                  <p className="text-xs text-slate-300 italic">"{res.input}"</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Expected</span>
                  <p className="text-xs text-slate-300">{res.expected}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-bold text-primary uppercase">Model Output</span>
                <div className="text-xs leading-relaxed text-slate-200 bg-black/30 p-4 rounded-2xl border border-white/5 font-mono">
                  {res.actual}
                </div>
              </div>

              {/* Faithfulness Ratio (Report 2) */}
              <div className="flex items-center gap-2 bg-green-400/5 border border-green-400/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-green-400 text-sm">fact_check</span>
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">
                  Ratio de Fidelidad: {res.metrics?.faithfulnessRatio} afirmaciones soportadas
                </span>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Judge Reasoning</p>
                <p className="text-xs text-slate-400 leading-relaxed italic">"{res.reasoning}"</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-background-dark border-t border-white/5">
        <button onClick={() => navigate('/')} className="w-full bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all">
          Exit Review
        </button>
      </div>
    </div>
  );
};

export default EvaluationResults;
