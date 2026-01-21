
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PromptVersion, BattleResult, SavedComparison } from '../types';
import { runPrompt } from '../services/geminiService';
import { evaluateBattlePair, evaluateBattlePairSingleSide } from '../services/judgeService';
import { generateTestCases } from '../services/geminiService';
import { extractVariables } from '../utils/promptUtils';
import { OptimizerService, EvolutionResult } from '../services/optimizerService';

interface Props {
  versions: PromptVersion[];
  addToast: (text: string, type?: any) => void;
}

interface SipdoScenario {
  type: string;
  input: string;
  result: BattleResult;
}

const PromptBattle: React.FC<Props> = ({ versions, addToast }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { contentA?: string; contentB?: string } | null;

  const [contentA, setContentA] = useState(state?.contentA || versions[0]?.content || '');
  const [contentB, setContentB] = useState(state?.contentB || versions[1]?.content || versions[0]?.content || '');
  const [isBattling, setIsBattling] = useState(false);
  const [sipdoResults, setSipdoResults] = useState<SipdoScenario[]>([]);
  const [finalAggregate, setFinalAggregate] = useState<{ scoreA: number, scoreB: number, winner: string } | null>(null);

  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null);

  // Evolution State
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionResult, setEvolutionResult] = useState<EvolutionResult | null>(null);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [savedHistory, setSavedHistory] = useState<SavedComparison[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('battle_history');
    if (saved) {
      setSavedHistory(JSON.parse(saved));
    }
  }, []);

  const saveBattle = () => {
    if (!finalAggregate) return;
    const newSave: SavedComparison = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      promptA: contentA,
      promptB: contentB,
      scoreA: finalAggregate.scoreA,
      scoreB: finalAggregate.scoreB,
      winner: finalAggregate.winner as 'A' | 'B' | 'Tie' | 'Inconclusive'
    };
    const updated = [newSave, ...savedHistory];
    setSavedHistory(updated);
    localStorage.setItem('battle_history', JSON.stringify(updated));
    addToast("Comparison saved to History", "success");
  };

  const deleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedHistory.filter(h => h.id !== id);
    setSavedHistory(updated);
    localStorage.setItem('battle_history', JSON.stringify(updated));
    addToast("Entry deleted", "info");
  };

  const loadSave = (save: SavedComparison) => {
    setContentA(save.promptA);
    setContentB(save.promptB);
    setFinalAggregate({
      scoreA: save.scoreA,
      scoreB: save.scoreB,
      winner: save.winner
    });
    setSipdoResults([]); // Clear detailed scenarios as we only saved the aggregate
    setEvolutionResult(null);
    setShowHistory(false);
    addToast("Historical Comparison Loaded", "info");
  };

  useEffect(() => {
    const varsA = extractVariables(contentA);
    const varsB = extractVariables(contentB);
    setDetectedVars([...new Set([...varsA, ...varsB])]);
  }, [contentA, contentB]);

  const handleEvolve = async () => {
    if (!finalAggregate) return;

    setIsEvolving(true);
    try {
      // FORCE EVOLUTION LOGIC:
      // If Tie/Inconclusive, pick the one with higher Raw Score.
      // If strict tie in score, pick A.
      let winnerLabel = finalAggregate.winner;
      if (winnerLabel === 'Inconclusive' || winnerLabel === 'Tie') {
        winnerLabel = finalAggregate.scoreA >= finalAggregate.scoreB ? 'A' : 'B';
      }

      const winnerPrompt = winnerLabel === 'A' ? contentA : contentB;
      const loserPrompt = winnerLabel === 'A' ? contentB : contentA;

      // Gather reasoning from all scenarios where the winner actually won
      const relevantScenarios = sipdoResults.filter(r => r.result.winner === finalAggregate.winner);
      const reasoningCombined = relevantScenarios.map(r => `Scenario (${r.type}): ${r.result.reasoning}`).join('\n\n');
      const failedInputs = sipdoResults.filter(r => (finalAggregate.winner === 'A' && r.result.scoreA < 70) || (finalAggregate.winner === 'B' && r.result.scoreB < 70)).map(r => r.input);

      const evolution = await OptimizerService.evolvePrompt({
        winnerPrompt,
        loserPrompt,
        judgeReasoning: reasoningCombined,
        failedCases: failedInputs,
        history: versions.map(v => ({ version: v.version, message: v.message }))
      });

      // CONVERGENCE CHECK (SOTA Safety)
      if (evolution.master_mutation.mutation.trim() === winnerPrompt.trim()) {
        addToast("Ya tienes el prompt óptimo. No se encontraron mejoras significativas.", "success");
        setEvolutionResult(null); // Ensure no new card is shown
      } else {
        setEvolutionResult(evolution);
        addToast("Evolution Successful!", "success");
      }
    } catch (e) {
      console.error("Evolution failed", e);
      addToast("Evolution failed", "error");
    } finally {
      setIsEvolving(false);
    }
  };


  const runBatch = async (
    cases: Record<string, string>[],
    batchName: string
  ): Promise<{ display: SipdoScenario[], phasesp1: any[], phasesp2: any[] }> => {
    const p1Results: any[] = [];
    const p2Results: any[] = [];
    const batchDisplay: SipdoScenario[] = [];

    // PHASE 1
    for (const testCase of cases) {
      const type = (testCase as any).type || "Unknown";
      addToast(`[${batchName}] Phase 1/2: Assessing ${type}`, "info");
      const inputContext = JSON.stringify(testCase);
      // Use Single Side evaluation (A vs B)
      const result = await evaluateBattlePairSingleSide(contentA, contentB, inputContext);
      p1Results.push({ type, result });

      // Update UI with partial P1 result
      batchDisplay.push({ type, input: (testCase as any).input, result });
      setSipdoResults(prev => [...prev, { type, input: (testCase as any).input, result }]);
    }

    // PHASE 2
    for (const [i, testCase] of cases.entries()) {
      const type = (testCase as any).type || "Unknown";
      addToast(`[${batchName}] Phase 2/2: Verifying ${type}`, "info");
      const inputContext = JSON.stringify(testCase);
      // Use Single Side evaluation (B vs A) - Swapped
      const result = await evaluateBattlePairSingleSide(contentB, contentA, inputContext); // Swap
      p2Results.push({ type, result });
    }

    return { display: batchDisplay, phasesp1: p1Results, phasesp2: p2Results };
  };

  const startBattle = async () => {
    if (!contentA.trim() || !contentB.trim()) {
      addToast("Both prompts are required", "error");
      return;
    }

    setIsBattling(true);
    setSipdoResults([]);
    setFinalAggregate(null);
    setEvolutionResult(null);

    try {
      addToast("Generating Synthetic Adversarial Data...", "info");
      const testCases = await generateTestCases(contentA, contentB, JSON.stringify(varValues));

      // SORT: Edge Cases First (Hyperband Priority)
      // The service returns objects with { type: "Simple" | "Complex" | "Edge Case", input: "..." }
      // We cast them to any to avoid strict type issues with _meta_type if it was used before, 
      // but the service guarantees 'type'.
      const priorityCases = testCases.filter((c: any) => c.type === 'Edge Case');
      const standardCases = testCases.filter((c: any) => c.type !== 'Edge Case');

      // RUN BATCH 1: PRIORITY (Edge Cases)
      const batch1 = await runBatch(priorityCases, "PRUNING CHECK");

      // CALCULATE INTERMEDIATE SCORE
      let survivalScoreA = 0;
      let survivalScoreB = 0;

      batch1.phasesp1.forEach((p1, i) => {
        const p2 = batch1.phasesp2[i];
        const scoreA = (p1.result.scoreA + p2.result.scoreB) / 2;
        const scoreB = (p1.result.scoreB + p2.result.scoreA) / 2;
        survivalScoreA += scoreA;
        survivalScoreB += scoreB;
      });

      const avgSurvivalA = priorityCases.length ? (survivalScoreA / priorityCases.length) : 100;
      const avgSurvivalB = priorityCases.length ? (survivalScoreB / priorityCases.length) : 100;

      let earlyStop = false;
      let batch2 = { display: [] as SipdoScenario[], phasesp1: [] as any[], phasesp2: [] as any[] };

      // HYPERBAND THRESHOLD: 40%
      if (avgSurvivalA < 40 && avgSurvivalB < 40) {
        earlyStop = true;
        addToast("EARLY STOPPING: Both prompts failed Edge Cases (<40%).", "warning");
      } else if (standardCases.length > 0) {
        // RUN BATCH 2: STANDARD
        batch2 = await runBatch(standardCases, "STANDARD BATCH");
      }

      // MERGE RESULTS
      const allCases = [...priorityCases, ...standardCases];
      const runCases = earlyStop ? priorityCases : allCases;
      const p1All = [...batch1.phasesp1, ...batch2.phasesp1];
      const p2All = [...batch1.phasesp2, ...batch2.phasesp2];

      // 4. SYNTHESIS & AGGREGATION
      let weightedScoreA = 0;
      let weightedScoreB = 0;
      let biasDetected = false;
      const weights = { "Simple": 0.2, "Complex": 0.3, "Edge Case": 0.5 };

      const finalDisplayResults = runCases.map((tc: any, i) => {
        const type = tc.type || "Unknown";
        const p1 = p1All[i].result;
        const p2 = p2All[i].result;

        const scenarioScoreA = Math.round((p1.scoreA + p2.scoreB) / 2);
        const scenarioScoreB = Math.round((p1.scoreB + p2.scoreA) / 2);

        let winner: 'A' | 'B' | 'Tie' | 'Inconclusive' = 'Tie';
        const p1Winner = p1.winner;
        const p2Winner = p2.winner === 'A' ? 'B' : (p2.winner === 'B' ? 'A' : 'Tie');

        if (p1Winner === p2Winner) winner = p1Winner;
        else if (p1Winner === 'Tie' || p2Winner === 'Tie') winner = 'Tie';
        else {
          winner = 'Inconclusive';
          biasDetected = true;
        }

        const reasoning = `
--- PHASE 1 (A vs B) ---
${p1.reasoning}

--- PHASE 2 (B vs A) ---
${p2.reasoning}
${winner === 'Inconclusive' ? '\n⚠️ POSITION BIAS DETECTED.' : ''}
        `.trim();

        const w = weights[type as keyof typeof weights] || 0.33;
        weightedScoreA += scenarioScoreA * w;
        weightedScoreB += scenarioScoreB * w;

        return {
          type,
          input: tc.input,
          result: {
            winner,
            scoreA: scenarioScoreA,
            scoreB: scenarioScoreB,
            reasoning
          }
        };
      });

      setSipdoResults(finalDisplayResults);

      const finalWinnerScore = weightedScoreA > weightedScoreB + 2 ? 'A' : (weightedScoreB > weightedScoreA + 2 ? 'B' : 'Tie');
      const finalWinner = biasDetected ? 'Inconclusive' : finalWinnerScore;

      setFinalAggregate({ scoreA: Math.round(weightedScoreA), scoreB: Math.round(weightedScoreB), winner: finalWinner });

      if (earlyStop) {
        addToast("Battle Pruned (Bayesian Early Stopping)", "warning");
      } else {
        addToast(biasDetected ? "Completed with Bias Warning" : "Scientific Verification Complete", biasDetected ? "warning" : "success");
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Audit process crashed";
      addToast(msg, "error");
    } finally {
      setIsBattling(false);
    }
  };

  const getScenarioIcon = (type: string) => {
    if (type.includes("Simple")) return "check_circle";
    if (type.includes("Complex")) return "extension";
    if (type.includes("Edge")) return "warning";
    return "science";
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
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background-dark/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="size-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-base font-bold">Battle Arena</h2>
            <p className="text-[9px] text-primary font-bold uppercase tracking-[0.2em]">SIPDO Scientific Benchmark</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="bg-white/5 text-slate-300 font-bold px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            History
          </button>
          <button
            onClick={startBattle}
            disabled={isBattling}
            className="bg-primary text-white font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[20px]">{isBattling ? 'sync' : 'gavel'}</span>
            {isBattling ? 'Running SIPDO Cycle...' : 'Start Battle'}
          </button>
        </div>
      </header>

      {finalAggregate && (
        <div className="shrink-0 bg-surface-dark border-b border-white/5 p-4 flex justify-between items-center shadow-lg relative z-20">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-full flex items-center justify-center ${finalAggregate.winner === 'Inconclusive' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'}`}>
              <span className="material-symbols-outlined text-2xl">{finalAggregate.winner === 'Inconclusive' ? 'warning' : 'emoji_events'}</span>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Global Verdict</h3>
              <p className="text-[10px] text-slate-400">Weighted Consensus</p>
            </div>
          </div>
          <div className="flex gap-8 items-center">
            {/* Evolution Button - Now allowed even for Inconclusive/Tie if scores differ */}
            {finalAggregate && (
              <>
                <button
                  onClick={saveBattle}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-primary hover:border-primary/50 transition-all"
                  title="Save Comparison"
                >
                  <span className="material-symbols-outlined">bookmark_add</span>
                </button>

                <button
                  onClick={handleEvolve}
                  disabled={isEvolving}
                  className={`border px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 ${finalAggregate.winner === 'Inconclusive' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' : 'bg-purple-600/20 text-purple-400 border-purple-500/30 hover:bg-purple-600/40'
                    }`}
                >
                  <span className="material-symbols-outlined text-base">{isEvolving ? 'hourglass_top' : 'biotech'}</span>
                  {isEvolving ? 'Mutating DNA...' : (finalAggregate.winner === 'Inconclusive' ? 'Force Evolution (Bias)' : 'Evolve Winner')}
                </button>
              </>
            )}

            <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-500 block">Score A</span>
              <span className={`text-2xl font-black ${finalAggregate.scoreA > finalAggregate.scoreB ? 'text-primary' : 'text-slate-400'}`}>{finalAggregate.scoreA}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-500 block">Score B</span>
              <span className={`text-2xl font-black ${finalAggregate.scoreB > finalAggregate.scoreA ? 'text-primary' : 'text-slate-400'}`}>{finalAggregate.scoreB}</span>
            </div>
          </div>
        </div>
      )}

      {/* EVOLUTION OUTCOME (UNITY EVOLUTION) */}
      {evolutionResult && (
        <div className="shrink-0 bg-purple-900/10 border-b border-purple-500/20 p-6 animate-in slide-in-from-top-4">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined">genetics</span>
                APE 2.0: Master Mutation Ready
              </h3>
              <p className="text-[10px] text-purple-300/60 mt-1">La IA ha sintetizado todas las mejoras en una versión definitiva.</p>
            </div>

            <button
              onClick={() => {
                const targetSide = finalAggregate?.winner === 'A' ? 'B' : 'A';
                if (targetSide === 'A') setContentA(evolutionResult.master_mutation.mutation);
                else setContentB(evolutionResult.master_mutation.mutation);
                setEvolutionResult(null);
                setSipdoResults([]);
                setFinalAggregate(null);
                addToast(`Applied Master Mutation`, 'success');
              }}
              className="bg-purple-500 text-white font-black px-6 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-purple-400 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              <span className="material-symbols-outlined">auto_fix_high</span>
              Apply & Battle
            </button>
          </div>

          <div className="bg-black/40 border border-purple-500/30 rounded-xl p-5 flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <span className="material-symbols-outlined text-9xl">biotech</span>
            </div>

            <div className="relative z-10">
              <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 px-2 py-1 rounded uppercase tracking-wider w-fit mb-3 block">
                SOTA SYNTHESIS
              </span>

              <p className="text-xs text-slate-300 mb-4 italic border-l-2 border-purple-500 pl-3 py-1">
                "{evolutionResult.master_mutation.logic}"
              </p>

              <div className="bg-black/60 rounded-lg p-3 overflow-y-auto max-h-48 text-[10px] font-mono text-purple-100/80 whitespace-pre-wrap border border-white/5">
                {evolutionResult.master_mutation.mutation}
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="flex-1 overflow-y-auto p-5 pb-32 hide-scrollbar">

        {/* SIPDO RESULTS LIST */}
        {sipdoResults.length > 0 && (
          <div className="mb-8 space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest px-1">Scenario Analysis Stream</h3>
            {sipdoResults.map((scenario, idx) => (
              <div key={idx} className="bg-surface-dark border border-white/5 rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-5">
                <div
                  onClick={() => setExpandedScenario(expandedScenario === idx ? null : idx)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className={`material-symbols-outlined text-xl text-slate-400`}>{getScenarioIcon(scenario.type)}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">{scenario.type}</h4>
                      <p className="text-[10px] text-slate-500 font-mono line-clamp-1 max-w-md">{scenario.input}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${scenario.result.winner === 'A' ? 'text-primary' : 'text-slate-600'}`}>A: {scenario.result.scoreA}</span>
                      <div className="h-3 w-[1px] bg-white/10"></div>
                      <span className={`text-xs font-bold ${scenario.result.winner === 'B' ? 'text-primary' : 'text-slate-600'}`}>B: {scenario.result.scoreB}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${scenario.result.winner === 'Inconclusive' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'
                      }`}>
                      {scenario.result.winner === 'Inconclusive' ? 'Bias Detected' : `Winner: ${scenario.result.winner}`}
                    </div>
                    <span className="material-symbols-outlined text-slate-500 transition-transform duration-300" style={{ transform: expandedScenario === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </div>
                </div>

                {expandedScenario === idx && (
                  <div className="p-4 bg-black/20 border-t border-white/5 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed animate-in fade-in">
                    <div className="mb-4 bg-black/40 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Full Input Payload</span>
                      {scenario.input}
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-2">Technical Reasoning Trace</span>
                    {scenario.result.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* INPUTS AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <VersionSelector side="A" current={contentA} />
          <VersionSelector side="B" current={contentB} />
        </div>

        {detectedVars.length > 0 && (
          <div className="bg-surface-dark p-6 rounded-3xl border border-white/5 shadow-2xl mt-8">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Global Base Variables (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedVars.map(v => (
                <div key={v} className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-primary ml-1 uppercase">{v}</label>
                  <textarea
                    value={varValues[v] || ""}
                    onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                    placeholder={`Insert base data for {{${v}}}...`}
                    className="bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-primary/50 resize-none h-24 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
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

      </div>

      {/* HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-background-dark border-l border-white/10 h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">history</span>
                Battle History
              </h3>
              <button onClick={() => setShowHistory(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedHistory.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm">No saved comparisons yet.</div>
              ) : (
                savedHistory.map(save => (
                  <div
                    key={save.id}
                    onClick={() => loadSave(save)}
                    className="bg-surface-dark border border-white/5 p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-white/5 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(save.timestamp).toLocaleDateString()} {new Date(save.timestamp).toLocaleTimeString()}
                      </span>
                      <button onClick={(e) => deleteSave(save.id, e)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`flex-1 text-center py-1 rounded ${save.winner === 'A' ? 'bg-primary/20 text-primary' : 'bg-black/20 text-slate-500'}`}>
                        <span className="text-xs font-bold">A: {save.scoreA}</span>
                      </div>
                      <div className="text-[10px] font-black text-slate-600">VS</div>
                      <div className={`flex-1 text-center py-1 rounded ${save.winner === 'B' ? 'bg-primary/20 text-primary' : 'bg-black/20 text-slate-500'}`}>
                        <span className="text-xs font-bold">B: {save.scoreB}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 text-[10px] text-slate-400 line-clamp-2 font-mono bg-black/20 p-2 rounded border border-white/5">
                        {save.promptA.substring(0, 100)}...
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptBattle;
