import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizePrompt, runPrompt, InterviewerResponse, OptimizationResult, ChatMessage } from '../services/geminiService';
import { EvaluationService, EvaluationResult } from '../services/evaluationService';
import { extractVariables } from '../utils/promptUtils';
import { EvaluationDashboard } from './EvaluationDashboard';
import { OnboardingTour } from './OnboardingTour';
import { TemplateSelector } from './TemplateSelector';
import { ExportModal } from './ExportModal';
import { RichPromptEditor } from './RichPromptEditor';
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


const PromptEditor: React.FC<Props> = ({ content, setContent, onSave, onExport, onImport, addToast, contextData, setContextData }) => {
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);

  const [rootFolder, setRootFolder] = useState<FileItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Version Refinement');

  // Hydration Guard
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
  const [proposedContent, setProposedContent] = useState<string | null>(() => {
    return optResult?.refinedPrompt || null;
  });
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const [vars, setVars] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('lastTestVars');
    return saved ? JSON.parse(saved) : {};
  });

  const isBusy = isOptimizing || isTesting || isLoadingFile || isScanning || isEvaluating;
  const extractedVarsFromContent = useMemo(() => extractVariables(content), [content]);

  // Initialization Effect
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // PERSISTENCE ENGINE
  useEffect(() => {
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
    if (isBusy || !content.trim()) return;

    const controller = new AbortController();
    setAbortController(controller);
    setIsOptimizing(true);
    setProgressLog([]);
    setProposedContent(null);
    setOptResult(null);

    const onProgress = (stage: string, detail: string) => {
      setProgressLog(prev => [...prev, `[${stage}] ${detail}`]);
    };

    try {
      let historyToUse = [...chatHistory];
      if (skipInterviewer) {
        historyToUse.push({
          role: 'user',
          content: "[SYSTEM: User forced optimization. Ignore clarification requests.]"
        });
      }

      const result = await optimizePrompt(
        content,
        historyToUse,
        onProgress,
        contextData,
        { skipInterviewer, model: selectedModel, signal: controller.signal }
      );

      if ('refinedPrompt' in result) {
        setProposedContent(result.refinedPrompt);
        setOptResult(result);
        if (result.partialSuccess) addToast('Recuperación parcial activada.', 'info');
        else addToast('Arquitectura refinada.', 'success');

        if (result.metadata.criticScore > 85) {
          setShowReasoning(true);
        }

        setChatHistory([]);
      } else if (result.status === 'NEEDS_CLARIFICATION') {
        setChatHistory(prev => [...prev,
        { role: 'user', content },
        { role: 'assistant', content: result.clarification_question || '' }
        ]);
        addToast(`IA: ${result.clarification_question}`, 'info');
      }
    } catch (err: any) {
      if (err.message === 'ABORTED' || err.name === 'AbortError') {
        addToast('Optimización cancelada.', 'info');
      } else {
        handleApiError(err);
      }
    } finally {
      setIsOptimizing(false);
      setAbortController(null);
    }
  };

  const cancelOptimization = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsOptimizing(false);
      addToast('Cancelando...', 'info');
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
    if (isBusy) return;
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

  const handleEvaluate = async () => {
    if (isBusy || !content.trim()) return;

    setIsEvaluating(true);
    setEvalResult(null);

    try {
      const output = await runPrompt(content, vars);
      const result = await EvaluationService.evaluateOutput(content, output, contextData);
      setEvalResult(result);
      addToast('Evaluación completada', 'success');
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex h-screen bg-background-dark overflow-hidden">
      <OnboardingTour />
      {showTemplates && <TemplateSelector onSelect={setContent} onClose={() => setShowTemplates(false)} />}
      {showExport && <ExportModal content={content} onClose={() => setShowExport(false)} />}

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
              onClick={() => navigate('/versions')}
              className={`size-10 flex items-center justify-center rounded-full hover:bg-white/10 ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isBusy}
              title="Version History"
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
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
                <option value="gemini-1.5-flash">Gemini Flash (Fast)</option>
                <option value="gemini-1.5-pro">Gemini Pro (Smart)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                  contentA: content,
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
          </div>

          <div className="flex flex-col lg:flex-row gap-6 h-[70vh]">
            {/* LEFT COLUMN: EDITOR */}
            <div className={`flex flex-col transition-all duration-500 ${proposedContent ? 'lg:w-[45%]' : 'w-full'}`}>
              <div className="flex-1 bg-surface-dark border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-0 bg-[length:200%_100%] transition-opacity duration-300 animate-shimmer" style={{ opacity: isOptimizing ? 1 : 0 }} />

                <div className="flex-1 bg-surface-dark border-r border-white/5 relative flex flex-col">
                  {/* Editor Area */}
                  <div className="flex-1 relative flex flex-col">
                    {/* CONTEXT INPUT RESTORATION */}
                    <div className="border-b border-white/5 bg-black/20">
                      <button
                        onClick={() => setShowContext(!showContext)}
                        className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">menu_book</span>
                          Global Context / Knowledge Base
                        </span>
                        <span className={`material-symbols-outlined text-sm transition-transform ${showContext ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>

                      {showContext && (
                        <div className="p-2 animate-in slide-in-from-top-2">
                          <textarea
                            value={contextData}
                            onChange={(e) => setContextData(e.target.value)}
                            placeholder="Paste relevant background context, rules, or code snippets here to help the AI understand your specific domain..."
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-primary/50 resize-y font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 relative">
                      <RichPromptEditor
                        value={content}
                        onChange={setContent}
                        disabled={isBusy}
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 border-t border-white/5 flex flex-col gap-3 bg-background-dark/50 backdrop-blur-sm z-20">

                      {/* THINKING INDICATOR */}
                      {isOptimizing && progressLog.length > 0 && (
                        <div className="mb-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                          <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                          </div>
                          <span className="text-xs font-mono text-primary animate-pulse">
                            {progressLog[progressLog.length - 1].replace(/^\[.*?\]\s*/, '')}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {isOptimizing ? (
                          <button
                            onClick={cancelOptimization}
                            className="flex-1 bg-danger/10 border border-danger/20 text-danger font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-danger/20"
                          >
                            <span className="material-symbols-outlined">cancel</span>
                            <span>Cancel Operation</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOptimize(false)}
                            className={`flex-1 bg-gradient-to-r from-primary to-secondary hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2 group/btn ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isBusy}
                          >
                            <span className="material-symbols-outlined group-hover/btn:scale-110 transition-transform">auto_awesome</span>
                            <span>Metacognitive Refine</span>
                          </button>
                        )}
                        <button
                          onClick={handleEvaluate}
                          disabled={isBusy || !content.trim()}
                          className={`px-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-xl font-bold transition-all flex items-center gap-2 ${isBusy ? 'opacity-50' : ''}`}
                        >
                          {isEvaluating ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">analytics</span>}
                          Evaluate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: COMPARISON & RESULTS */}
            {proposedContent && optResult && (
              <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in duration-500 min-h-0">
                {/* ... Existing Result Views (Assuming DiffView is used here) ... */}
                <div className="flex-1 bg-surface-dark border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl text-left">
                  <div className="bg-black/20 p-3 border-b border-white/5 flex justify-between items-center">
                    <span className="text-xs font-bold text-success flex items-center gap-2">
                      <span className="material-symbols-outlined">check_circle</span>
                      Optimization Success
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => { setContent(proposedContent); setProposedContent(null); }} className="text-[10px] font-bold bg-success/10 text-success px-3 py-1 rounded-full hover:bg-success/20 transition-colors uppercase">Accept</button>
                      <button onClick={() => setProposedContent(null)} className="text-[10px] font-bold bg-white/5 text-slate-400 px-3 py-1 rounded-full hover:bg-white/10 transition-colors uppercase">Dismiss</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    <DiffView original={content} modified={proposedContent} />
                  </div>

                  {/* Reasoning Panel */}
                  <div className="border-t border-white/5 bg-black/20 text-left">
                    <button
                      onClick={() => setShowReasoning(!showReasoning)}
                      className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                    >
                      <span>AI REASONING & LOGIC</span>
                      <span className={`material-symbols-outlined transition-transform ${showReasoning ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                    {showReasoning && optResult?.metadata && (
                      <div className="p-4 bg-black/40 border-t border-white/5 text-xs text-slate-400 font-mono space-y-2 animate-in slide-in-from-top-2">
                        {optResult.metadata.thinkingProcess && (
                          <div className="mb-4 p-3 bg-purple-900/10 border border-purple-500/20 rounded-lg text-purple-200/80">
                            <strong className="block text-purple-400 mb-1 uppercase text-[10px]">Chain of Thought:</strong>
                            {optResult.metadata.thinking_process}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <strong className="block text-slate-500 mb-1">SELECTED FRAMEWORK</strong>
                            <span className="text-primary">{optResult.metadata.thinkingProcess ? "Dynamic Chain-of-Thought" : "Standard"}</span>
                          </div>
                          <div>
                            <strong className="block text-slate-500 mb-1">CRITIC SCORE</strong>
                            <span className={optResult.metadata.criticScore > 80 ? 'text-success' : 'text-warning'}>{optResult.metadata.criticScore}/100</span>
                          </div>
                        </div>
                        <div>
                          <strong className="block text-slate-500 mb-1">CHANGES APPLIED</strong>
                          <ul className="list-disc pl-4 space-y-1">
                            {(optResult.metadata.changesMade || []).map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Evaluation Dashboard */}
          {evalResult && (
            <div className="mt-8 animate-in slide-in-from-bottom-4">
              <EvaluationDashboard result={evalResult} />
            </div>
          )}

          {/* Console / Test Panel */}
          {consoleOpen && (
            <DebuggerConsole
              isOpen={consoleOpen}
              onClose={() => setConsoleOpen(false)}
              logs={progressLog}
              testResult={testResult}
              vars={vars}
              setVars={setVars}
              onRunTest={handleTest}
              isBusy={isBusy}
            />
          )}

        </div>
      </main>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveVersionModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={(msg, rating) => {
            onSave(msg, rating);
            setShowSaveModal(false);
          }}
          initialMessage={commitMessage}
        />
      )}
    </div>
  );
};

export default PromptEditor;
