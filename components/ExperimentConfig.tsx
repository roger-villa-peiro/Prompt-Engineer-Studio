
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runPrompt, evaluateResponse } from '../services/geminiService';
import { TestCase } from '../types';
import { extractVariables } from '../utils/promptUtils';

interface Props {
  currentPrompt: string;
}

const ExperimentConfig: React.FC<Props> = ({ currentPrompt }) => {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0); // Progress percentage
  const [dataset, setDataset] = useState<TestCase[]>([
    { id: '1', input: "First test case context", expected: "Desired outcome for case 1" }
  ]);
  
  // Dynamic variables handling
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [inputVar, setInputVar] = useState<string>(''); // Which variable is the dynamic input
  const [staticVars, setStaticVars] = useState<Record<string, string>>({});

  const [newInput, setNewInput] = useState('');
  const [newExpected, setNewExpected] = useState('');

  useEffect(() => {
    const uniqueVars = extractVariables(currentPrompt);
    setDetectedVars(uniqueVars);
    
    if (uniqueVars.length > 0 && !inputVar) {
      setInputVar(uniqueVars[0]);
    }

    setStaticVars(prev => {
      const next: Record<string, string> = {};
      uniqueVars.forEach(v => {
        if (v !== inputVar) next[v] = prev[v] || "";
      });
      return next;
    });
  }, [currentPrompt, inputVar]);

  const addTestCase = () => {
    if (!newInput || !newExpected) return;
    setDataset([...dataset, { id: Math.random().toString(), input: newInput, expected: newExpected }]);
    setNewInput('');
    setNewExpected('');
  };

  const startEvaluation = async () => {
    if (detectedVars.length > 0 && !inputVar) {
      alert("Please select which variable will be replaced by the test case input.");
      return;
    }
    
    setIsRunning(true);
    setProgress(0);
    const results = [];
    
    for (let i = 0; i < dataset.length; i++) {
      const testCase = dataset[i];
      const startTime = Date.now();
      
      const executionVars = { ...staticVars };
      if (inputVar) {
        executionVars[inputVar] = testCase.input;
      }

      try {
        const actual = await runPrompt(currentPrompt, executionVars);
        const endTime = Date.now();
        const evalData = await evaluateResponse(testCase.input, actual, testCase.expected);
        
        results.push({
          ...testCase,
          actual,
          metrics: {
            faithfulness: evalData.scores.faithfulness,
            relevance: evalData.scores.relevance,
            coherence: evalData.scores.coherence,
            latency: `${endTime - startTime}ms`,
            cost: "$0.0002",
            faithfulnessRatio: `${evalData.claims.supported}/${evalData.claims.total}`
          },
          reasoning: evalData.reasoning
        });
      } catch (err) {
        console.error("Test case failed:", err);
      }

      setProgress(Math.round(((i + 1) / dataset.length) * 100));
    }

    setIsRunning(false);
    navigate('/experiment/results', { state: { results } });
  };

  return (
    <div className="flex flex-col h-full bg-background-dark">
      <header className="relative flex items-center justify-between p-4 border-b border-white/5 bg-background-dark/80 backdrop-blur-md">
        <button onClick={() => navigate('/')} className="size-10 flex items-center justify-center rounded-full hover:bg-white/10">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="text-base font-bold uppercase tracking-widest">Benchmarking Engine</h1>
        <div className="size-10"></div>
        
        {/* Progress Bar */}
        {isRunning && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 hide-scrollbar">
        {isRunning && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center gap-4 animate-pulse">
            <span className="material-symbols-outlined text-primary animate-spin">sync</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-primary">Executing Benchmark Suite</p>
              <p className="text-[10px] text-slate-500 uppercase font-black">Progress: {progress}% Complete</p>
            </div>
          </div>
        )}

        {/* Step 1: Variable Mapping */}
        <section className="bg-surface-dark p-6 rounded-3xl border border-white/5">
          <h2 className="text-[10px] font-black uppercase text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">settings_input_component</span>
            Step 1: Context Configuration
          </h2>
          
          <div className="space-y-4">
            {detectedVars.length > 0 ? (
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5 ml-1">Dynamic Input Variable</label>
                <select 
                  value={inputVar}
                  onChange={(e) => setInputVar(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                  disabled={isRunning}
                >
                  {detectedVars.map(v => <option key={v} value={v}>{"{{ " + v + " }}"}</option>)}
                </select>
                <p className="text-[9px] text-slate-500 mt-2 ml-1 italic">This variable will be replaced by each test case's input during the run.</p>
              </div>
            ) : (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                 <p className="text-xs text-primary font-medium">No variables detected. This will be a static benchmark against the current prompt.</p>
              </div>
            )}

            {detectedVars.filter(v => v !== inputVar).length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-3 ml-1">Fixed Variables (Static Context)</label>
                <div className="grid grid-cols-1 gap-3">
                  {detectedVars.filter(v => v !== inputVar).map(v => (
                    <div key={v} className="flex flex-col gap-1">
                      <span className="text-[9px] text-primary font-bold ml-1">{v}</span>
                      <input 
                        value={staticVars[v] || ""}
                        onChange={(e) => setStaticVars({...staticVars, [v]: e.target.value})}
                        placeholder={`Value for static {{${v}}}...`}
                        className="bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-primary/30"
                        disabled={isRunning}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Dataset */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">database</span>
               Step 2: Golden Dataset
            </h2>
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">{dataset.length} Cases</span>
          </div>

          <div className="space-y-3">
            {dataset.map((tc) => (
              <div key={tc.id} className="p-4 bg-surface-dark border border-white/5 rounded-2xl flex justify-between items-center group hover:border-primary/20 transition-all">
                <div className="flex-1">
                  <p className="text-xs text-white font-bold mb-1 line-clamp-1">{tc.input}</p>
                  <p className="text-[10px] text-slate-500 italic">Expected: {tc.expected}</p>
                </div>
                {!isRunning && (
                  <button onClick={() => setDataset(dataset.filter(c => c.id !== tc.id))} className="text-slate-600 hover:text-danger p-2">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Add New Case Form */}
        {!isRunning && (
          <section className="bg-surface-dark/40 p-6 rounded-3xl border border-dashed border-white/10">
            <h3 className="text-[10px] font-black uppercase text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Add New Test Case
            </h3>
            <div className="space-y-4">
              <textarea 
                placeholder="Test input context or scenario description..." 
                value={newInput} 
                onChange={e => setNewInput(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs outline-none focus:border-primary/50 h-20 resize-none" 
              />
              <input 
                placeholder="Expected outcome description..." 
                value={newExpected} 
                onChange={e => setNewExpected(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50" 
              />
              <button onClick={addTestCase} className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                Add to Dataset
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="p-6 bg-background-dark/80 backdrop-blur-md border-t border-white/5">
        <button 
          onClick={startEvaluation}
          disabled={isRunning || dataset.length === 0}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">{isRunning ? 'sync' : 'analytics'}</span>
          {isRunning ? `Analyzing Case ${Math.ceil((progress/100)*dataset.length)}...` : 'Run Benchmarking Suite'}
        </button>
      </div>
    </div>
  );
};

export default ExperimentConfig;
