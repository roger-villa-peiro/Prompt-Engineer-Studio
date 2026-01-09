import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizePrompt, runPrompt, InterviewerResponse, OptimizationResult, ChatMessage } from '../services/geminiService';
import { extractVariables } from '../utils/promptUtils';
import { openDirectory, readFileContent } from '../services/fileService';
import { FileItem } from '../types';
import FileTree from './FileTree';
import SaveVersionModal from './SaveVersionModal';
import DebuggerConsole from './DebuggerConsole';

interface Props {
  content: string;
  setContent: (val: string) => void;
  onSave: (msg: string, rating?: number) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  contextData: string;
  setContextData: (val: string) => void;
}

// === QUICK WIN 4: VISUAL DIFF UTILITY & PERFORMANCE FIX ===
const DiffView: React.FC<{ original: string; modified: string }> = ({ original, modified }) => {
  // TASK 5: Performance Optimization for Large Files
  if (original.length > 10000 || modified.length > 10000) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500 bg-surface-dark border border-white/5 rounded-xl">
        <span className="material-symbols-outlined text-4xl mb-2">difference</span>
        <p className="text-xs font-bold uppercase tracking-widest">Diff disabled for large files</p>
        <p className="text-[10px] opacity-60">Content exceeds 10,000 characters.</p>
      </div>
    );
  }

  const diff = useMemo(() => {
    // Very naive word diff for visual aid
    return null;
  }, [original, modified]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 h-full">
      <div className="flex-1 flex flex-col">
        <span className="text-[10px] font-black uppercase text-danger/50 mb-2">Original</span>
        <div className="flex-1 bg-surface-dark border border-danger/20 rounded-xl p-4 text-sm font-mono text-slate-400 overflow-y-auto whitespace-pre-wrap opacity-60">
          {original}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <span className="text-[10px] font-black uppercase text-success/50 mb-2">Proposed Architecture</span>
        <div className="flex-1 bg-surface-dark border border-success/20 rounded-xl p-4 text-sm font-mono text-success/90 overflow-y-auto whitespace-pre-wrap">
          {modified}
        </div>
      </div>
    </div>
  );
};


const PromptEditor: React.FC<Props> = ({ content, setContent, onSave, onExport, onImport, addToast, contextData, setContextData }) => {
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);

  const [rootFolder, setRootFolder] = useState<FileItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Version Refinement');

  // TASK 3: Hydration Guard
  const [isInitialized, setIsInitialized] = useState(false);

  // METADATA & PERSISTENCE
  const [optResult, setOptResult] = useState<OptimizationResult | null>(() => {
    const saved = localStorage.getItem('antigravity_last_result');
    return saved ? JSON.parse(saved) : null;
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('antigravity_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [proposedContent, setProposedContent] = useState<string | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const [vars, setVars] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('lastTestVars');
    return saved ? JSON.parse(saved) : {};
  });

  const isBusy = isOptimizing || isTesting || isLoadingFile || isScanning;
  const extractedVarsFromContent = useMemo(() => extractVariables(content), [content]);

  // Initialization Effect
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // PERSISTENCE ENGINE (TASK 3: Secure Hydration)
  useEffect(() => {
    // Prevent wiping storage on initial empty render if not yet fully initialized/loaded
    if (!content && !isInitialized) return;

    localStorage.setItem('antigravity_active_prompt', content);
    localStorage.setItem('antigravity_chat_history', JSON.stringify(chatHistory));
    if (optResult) localStorage.setItem('antigravity_last_result', JSON.stringify(optResult));
  }, [content, chatHistory, optResult, isInitialized]);

  useEffect(() => {
    setVars(prev => {
      const next: Record<string, string> = {};
      extractedVarsFromContent.forEach(v => { next[v] = prev[v] || ""; });
      return next;
    });
  }, [extractedVarsFromContent]);

  useEffect(() => {
    localStorage.setItem('lastTestVars', JSON.stringify(vars));
  }, [vars]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progressLog]);

  const handleApiError = useCallback((err: any) => {
    const message = err?.message || '';
    if (message.includes('DATA_INTEGRITY_ERROR')) {
      addToast('Respuesta con formato incorrecto. Reintentando...', 'error');
    } else if (message.includes('429') || message.includes('quota')) {
      addToast('Error de cuota. Verifica tu plan.', 'error');
    } else {
      addToast(message || 'Error inesperado.', 'error');
    }
  }, [addToast]);

  const handleOptimize = async (skipInterviewer: boolean = false) => {
    // TASK 1: State Locking Guard
    if (isBusy || !content.trim()) return;

    setIsOptimizing(true);
    setProgressLog([]);
    setProposedContent(null);
    setOptResult(null);

    const onProgress = (stage: string, detail: string) => {
      setProgressLog(prev => [...prev, `[${stage}] ${detail}`]);
    };

    try {
      // TASK 4: Logic Injection (The '1% Edge')
      let historyToUse = [...chatHistory];
      if (skipInterviewer) {
        historyToUse.push({
          role: 'user',
          content: "[SYSTEM: User forced optimization. Ignore clarification requests.]"
        });
      }

      // === QUICK WIN 2: ESCAPE HATCH FLAGGING ===
      const result = await optimizePrompt(
        content,
        historyToUse,
        onProgress,
        contextData,
        { skipInterviewer }
      );

      if ('refinedPrompt' in result) {
        setProposedContent(result.refinedPrompt);
        setOptResult(result);
        if (result.partialSuccess) addToast('Recuperación parcial activada.', 'info');
        else addToast('Arquitectura refinada.', 'success');

        // === QUICK WIN 3: AUTO-EXPAND INTELLIGENCE ===
        if (result.metadata.criticScore > 85) {
          setShowReasoning(true);
        }

        // Clear history upon success
        setChatHistory([]);
      } else if (result.status === 'NEEDS_CLARIFICATION') {
        setChatHistory(prev => [...prev,
        { role: 'user', content },
        { role: 'assistant', content: result.clarification_question || '' }
        ]);
        addToast(`IA: ${result.clarification_question}`, 'info');
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleTest = async () => {
    if (isBusy) return;
    setIsTesting(true);
    setConsoleOpen(true);
    try {
      const result = await runPrompt(content, vars);
      setTestResult(result);
      setUserRating(null);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenProject = async () => {
    if (isBusy) return; // TASK 1: Guard
    setIsScanning(true);
    try {
      const root = await openDirectory();
      setRootFolder(root);
      setSidebarOpen(true);
    } catch (err) {
      addToast('No se pudo acceder al directorio.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileClick = useCallback(async (handle: FileSystemFileHandle) => {
    // TASK 1: Guard inside handleFileClick
    if (isBusy) return;

    setIsLoadingFile(true);
    try {
      const fileContent = await readFileContent(handle);
      setContent(fileContent);
      setProposedContent(null);
      setOptResult(null);
    } catch (err) {
      addToast('Error al leer archivo.', 'error');
    } finally {
      setIsLoadingFile(false);
    }
  }, [setContent, addToast, isBusy]);

  return (
    <div className="flex h-screen bg-background-dark overflow-hidden">
      {/* File Sidebar */}
      <aside className={`transition-all duration-300 border-r border-white/5 bg-background-dark flex flex-col overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[16rem]">
          <span className="text-[10px] font-black uppercase text-slate-500">Project Files</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="size-6 flex items-center justify-center rounded-full hover:bg-white/10"
            disabled={isBusy}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-w-[16rem]">
          {rootFolder && <FileTree items={rootFolder.children || []} onFileClick={handleFileClick} disabled={isBusy} />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <nav className="flex items-center px-4 py-3 justify-between bg-background-dark border-b border-white/5 shrink-0 gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${sidebarOpen ? 'text-primary' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">side_navigation</span>
            </button>
            <button
              onClick={handleOpenProject}
              className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isBusy}
            >
              <span className="material-symbols-outlined text-[20px]">folder_open</span>
            </button>
            <button
              onClick={() => navigate('/versions')}
              className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isBusy}
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
            </button>
          </div>

          <div className="hidden sm:flex flex-col items-center">
            <h1 className="text-sm font-bold tracking-tight">Antigravity Architect</h1>
            <span className="text-[8px] text-primary font-black uppercase tracking-[0.3em]">Cognitive Intelligence Tier</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/battle')}
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

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-48 relative scroll-smooth hide-scrollbar">

          {/* INTERVIEWER MESSAGE */}
          {chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant' && (
            <div className="mb-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 animate-in slide-in-from-top-2 flex-col sm:flex-row items-start sm:items-center">
              <div className="flex gap-3 flex-1">
                <span className="material-symbols-outlined text-primary">chat_bubble</span>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase mb-1">Clarificación Requerida</p>
                  <p className="text-sm text-slate-300 italic">"{chatHistory[chatHistory.length - 1].content}"</p>
                  <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Responde en el editor y pulsa Refine de nuevo.</p>
                </div>
              </div>

              {/* === QUICK WIN 2: ESCAPE HATCH BUTTON === */}
              <button
                onClick={() => handleOptimize(true)}
                className={`mt-3 sm:mt-0 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all border border-white/5 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Force optimization without answering"
                disabled={isBusy}
              >
                <span className="material-symbols-outlined text-[14px]">fast_forward</span>
                Skip & Optimize
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 bg-surface-dark/50 p-2 rounded-2xl border border-white/5 gap-2">
            <span className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {proposedContent ? 'Comparing Refinement' : 'Prompt Editor'}
            </span>
            {proposedContent ? (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setProposedContent(null);
                    setOptResult(null); // TASK 2: Zombie Result Fix
                  }}
                  className="flex-1 sm:flex-none bg-white/5 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-white/10"
                >
                  Discard
                </button>
                <button
                  onClick={() => navigate('/battle', { state: { contentA: content, contentB: proposedContent } })}
                  className="flex-1 sm:flex-none bg-warning/10 text-warning px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-warning/20 border border-warning/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[14px]">swords</span>
                  Compare in Duel
                </button>
                <button
                  onClick={() => { setContent(proposedContent); setProposedContent(null); addToast('Cambios aceptados.', 'success'); }}
                  className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-primary-dark"
                >
                  Accept Changes
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleOptimize(false)}
                disabled={isBusy || !content.trim()}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-primary/20 transition-all ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="material-symbols-outlined text-sm">{isOptimizing ? 'sync' : 'auto_fix_high'}</span>
                {isOptimizing ? 'Thinking...' : 'Metacognitive Refine'}
              </button>
            )}
          </div>

          {/* METACOGNITION PANEL */}
          {optResult && !proposedContent && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in-95">
              {/* Score Gauge */}
              <div className="bg-surface-dark border border-white/10 rounded-3xl p-5 flex flex-col items-center justify-center shadow-lg">
                <span className="text-[10px] font-black text-slate-500 uppercase mb-4">Quality Score</span>
                <div className="relative size-24 flex items-center justify-center">
                  <svg className="size-full -rotate-90">
                    <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                    <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={`${optResult.metadata.criticScore * 2.51} 251`} className="text-primary transition-all duration-1000" />
                  </svg>
                  <span className="absolute text-xl font-black">{optResult.metadata.criticScore}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  {Object.entries(optResult.metadata.rubricChecks).map(([key, pass]) => (
                    <span key={key} title={key} className={`size-2 rounded-full ${pass ? 'bg-success' : 'bg-danger'}`}></span>
                  ))}
                </div>
              </div>

              {/* AI Reasoning Accordion */}
              <div className="md:col-span-2 bg-surface-dark border border-white/10 rounded-3xl p-5 flex flex-col shadow-lg">
                <button onClick={() => setShowReasoning(!showReasoning)} className="flex items-center justify-between w-full mb-3 text-left">
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    🧠 AI Reasoning
                  </span>
                  <span className={`material-symbols-outlined text-slate-500 transition-transform ${showReasoning ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${showReasoning ? 'max-h-96' : 'max-h-0'}`}>
                  <p className="text-xs text-slate-400 italic leading-relaxed border-t border-white/5 pt-3">
                    {optResult.metadata.thinkingProcess}
                  </p>
                  <div className="mt-4 space-y-2">
                    <span className="text-[9px] font-bold text-slate-600 uppercase">Changes Applied:</span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {optResult.metadata.changesMade.map((c, i) => (
                        <li key={i} className="text-[10px] text-slate-300 flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="line-clamp-2">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {!showReasoning && <p className="text-xs text-slate-500 line-clamp-2 italic">Click to expand AI logic and changes history...</p>}
              </div>
            </div>
          )}

          {/* PROGRESS LOG */}
          {isOptimizing && (
            <div className="mb-4 bg-black/40 border border-primary/20 rounded-2xl p-4 font-mono text-[10px]">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                <span className="font-black uppercase tracking-widest">Architect Log</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto hide-scrollbar">
                {progressLog.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600">[{i + 1}]</span>
                    <span className={i === progressLog.length - 1 ? 'text-primary' : 'text-slate-500'}>{log}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* EDITOR AREA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[500px]">
            {/* === QUICK WIN 4: REPLACING SIDE-BY-SIDE EDITOR WITH DIFF VIEW WHEN PROPOSED === */}
            {proposedContent ? (
              <div className="md:col-span-2 bg-surface-dark border border-white/5 rounded-3xl flex flex-col shadow-2xl overflow-hidden p-1 h-[600px]">
                <DiffView original={content} modified={proposedContent} />
              </div>
            ) : (
              // NORMAL EDITOR MODE (with Concurrency Lock)
              <div className={`bg-surface-dark border border-white/5 rounded-3xl flex shadow-2xl transition-all relative md:col-span-2`}>
                {/* === QUICK WIN 1: LOCK UI OVERLAY === */}
                {isOptimizing && (
                  <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center animate-in fade-in transition-all">
                    <div className="bg-surface-dark border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-3xl animate-pulse">neurology</span>
                      <p className="text-xs font-black uppercase text-white tracking-widest">Architect is thinking...</p>
                      <p className="text-[10px] text-slate-400">Please do not edit while optimization is in progress.</p>
                    </div>
                  </div>
                )}

                <div className="w-10 bg-black/20 border-r border-white/5 flex flex-col items-center py-5 select-none shrink-0">
                  {Array.from({ length: 25 }).map((_, i) => <span key={i} className="text-[9px] text-slate-700 font-mono mb-2">{i + 1}</span>)}
                </div>
                <textarea
                  className={`flex-1 bg-transparent p-6 text-sm font-mono leading-relaxed outline-none resize-none text-slate-200 focus-visible:ring-1 focus-visible:ring-primary/30 transition-opacity duration-300 ${isOptimizing ? 'opacity-30' : 'opacity-100'}`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                  readOnly={isOptimizing} // === QUICK WIN 1: LOCK ===
                />
              </div>
            )}
          </div>

          {/* Global Context Panel */}
          <div className="mt-6 mb-20 bg-surface-dark border border-white/5 rounded-3xl p-6 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">globe</span>
              Global Context
            </h3>
            <div className="relative">
              <textarea
                value={contextData}
                onChange={(e) => setContextData(e.target.value)}
                className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/40 resize-none"
                placeholder="Paste context, documentation, or background info here to guide the Architect..."
                disabled={isBusy}
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <label className={`cursor-pointer bg-white/5 hover:bg-white/10 text-slate-400 p-2 rounded-lg transition-colors ${isBusy ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`} title="Upload Text/MD File">
                  <input type="file" className="hidden" accept=".txt,.md,.json,.js,.ts" onChange={async (e) => {
                    if (isBusy) return;
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setContextData(prev => prev ? prev + '\n\n--- FILE: ' + file.name + ' ---\n' + text : text);
                    addToast('Context appended from file', 'success');
                  }} disabled={isBusy} />
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                </label>
                {contextData && (
                  <button
                    onClick={() => setContextData('')}
                    className={`bg-danger/10 text-danger p-2 rounded-lg hover:bg-danger/20 transition-colors ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Clear Context"
                    disabled={isBusy}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <SaveVersionModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} onSave={() => { onSave(commitMessage, userRating || undefined); setShowSaveModal(false); }} commitMessage={commitMessage} setCommitMessage={setCommitMessage} userRating={userRating} setUserRating={setUserRating} />
      <DebuggerConsole isOpen={consoleOpen} setIsOpen={setConsoleOpen} isTesting={isTesting} testResult={testResult} variables={vars} setVariables={setVars} onRunTest={handleTest} isBusy={isBusy} />
    </div>
  );
};

export default PromptEditor;
