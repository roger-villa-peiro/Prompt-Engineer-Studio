import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizePrompt, runPrompt, InterviewerResponse, OptimizationResult, ChatMessage } from '../services/geminiService';
import { classifyIntent } from '../services/routerService'; // ROUTER INTEGRATION
import { detectVibeFromFiles, getVibeString } from '../services/vibeService'; // VIBE CODER
import { EvaluationService, EvaluationResult } from '../services/evaluationService';
import { extractVariables, parseContextVariables } from '../utils/promptUtils';
import { EvaluationDashboard } from './EvaluationDashboard';
import { OnboardingTour } from './OnboardingTour';
import { TemplateSelector } from './TemplateSelector';
import { ExportModal } from './ExportModal';
import { RichPromptEditor } from './RichPromptEditor';
import { openDirectory, readFileContent } from '../services/fileService';
import { FileItem, Attachment } from '../types';
import FileTree from './FileTree';
import SaveVersionModal from './SaveVersionModal';
import DebuggerConsole from './DebuggerConsole';
import { ThinkingViewer } from './ThinkingViewer';

interface Props {
  content: string;
  setContent: (val: string) => void;
  onSave: (msg: string, rating?: number) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  contextData: string;
  setContextData: (val: string) => void;
  attachments: Attachment[];
  setAttachments: (val: Attachment[]) => void;
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


const SpecStageViewer: React.FC<{
  result: OptimizationResult;
  onAdvance: (input: string) => void;
  isBusy: boolean;
}> = ({ result, onAdvance, isBusy }) => {
  const [input, setInput] = useState('');
  const stage = result.specStage;
  const artifacts = result.artifacts;

  return (
    <div className="flex flex-col h-full bg-surface-dark border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* HEADER */}
      <div className="bg-black/20 p-4 border-b border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
            <span className="material-symbols-outlined">psychology</span>
            Spec Architect Flow
          </span>
          <div className="flex gap-1">
            {['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].map((s, i) => {
              const currentIdx = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].indexOf(stage || '');
              const mapIdx = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'COMPLETE'].indexOf(s);
              return (
                <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${mapIdx <= currentIdx ? 'bg-primary' : 'bg-white/10'}`} />
              )
            })}
          </div>
        </div>
        <div className="text-xl font-bold text-white">
          {stage === 'REQUIREMENTS' && "Requirements Gathering"}
          {stage === 'DESIGN' && "System Architecture"}
          {stage === 'TASKS' && "Execution Plan"}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {stage === 'REQUIREMENTS' && artifacts?.requirements && (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <h3 className="text-sm font-bold text-primary mb-2">CLARIFICATION NEEDED</h3>
              <p className="text-slate-300 text-sm mb-4">{artifacts.requirements.thought_process}</p>
              <ul className="space-y-2">
                {artifacts.requirements.questions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Your Answers</label>
              <textarea
                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 min-h-[150px]"
                placeholder="Answer the questions here to proceed to design..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />
            </div>
          </div>
        )}

        {stage === 'DESIGN' && artifacts?.design && (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            <div className="p-4 bg-surface-dark border border-white/5 rounded-xl">
              <code className="text-xs font-mono text-cyan-400 block whitespace-pre-wrap">
                {artifacts.design.mermaid_diagram}
              </code>
            </div>
            <div className="p-4 bg-surface-dark border border-white/5 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Data Structure</h4>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{artifacts.design.data_models}</pre>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-sm text-purple-200">Review the design above. Use the chat to request changes, or click approve to generate tasks.</p>
            </div>
          </div>
        )}

        {stage === 'TASKS' && artifacts?.tasks && (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            {artifacts.tasks.tasks.map(t => (
              <div key={t.id} className="p-4 bg-surface-dark border border-white/5 rounded-xl flex gap-3">
                <div className="size-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-500">{t.id}</div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.title}</h4>
                  <ul className="mt-2 text-xs text-slate-400 space-y-1 list-disc pl-4">
                    {t.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
        <button className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white" disabled={isBusy}>
          Request Changes
        </button>
        <button
          className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          onClick={() => onAdvance(input || "Approved")}
          disabled={isBusy || (stage === 'REQUIREMENTS' && !input.trim())}
        >
          {isBusy ? 'Thinking...' : (stage === 'TASKS' ? 'Finalize' : 'Proceed')}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};


const PromptEditor: React.FC<Props> = ({ content, setContent, onSave, onExport, onImport, addToast, contextData, setContextData, attachments, setAttachments }) => {
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-preview');

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
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // 1. ROUTER V2: CLASSIFY INTENT & SUBTYPE
      onProgress('ROUTER', 'Detectando intención y arquetipo...');
      const historyCtx = historyToUse.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const routerResult = await classifyIntent(content, historyCtx);
      onProgress('ROUTER', `Modo: ${routerResult.mode} | SubTipo: ${routerResult.subType || 'GENERAL'}`);

      const result = await optimizePrompt(
        content,
        historyToUse,
        onProgress,
        contextData,
        {
          skipInterviewer,
          model: selectedModel,
          signal: controller.signal,
          attachments,
          subType: routerResult.subType, // Inject Specialist DNA
          vibeContext: contextData // VIBE CODER INJECTION
        }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    let processedCount = 0;
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Get just the base64 part
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;

        newAttachments.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          data: base64
        });

        processedCount++;
      } catch (err) {
        console.error("File processing error:", err);
        addToast(`Failed to process ${file.name}`, 'error');
      }
    }

    setAttachments([...attachments, ...newAttachments]);
    setIsProcessingFile(false);
    addToast(`${processedCount} files attached`, 'success');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleEvaluate = async () => {
    if (isBusy || !content.trim()) return;

    setIsEvaluating(true);
    setEvalResult(null);

    try {
      // FIX: Parse variables defined in context (e.g. {{text}}=...)
      const contextVars = parseContextVariables(contextData);
      const runtimeVars = { ...vars, ...contextVars }; // Overlay context variables on top of console vars

      const output = await runPrompt(content, runtimeVars);
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
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro (Thinking)</option>
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
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] uppercase text-slate-500 font-bold">Additional Knowledge</span>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*,.txt,.md,.json,.js,.ts,.py,.csv"
                                disabled={isOptimizing}
                              />
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingFile || isOptimizing}
                                className={`text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors ${isProcessingFile || isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span className="material-symbols-outlined text-sm">attach_file</span>
                                {isProcessingFile ? 'Processing...' : 'Attach Files / Images'}
                              </button>
                              <button
                                onClick={() => { setContextData(''); setAttachments([]); }}
                                disabled={isOptimizing}
                                className={`text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors ${isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span className="material-symbols-outlined text-sm">backspace</span>
                                Clear All
                              </button>
                            </div>
                          </div>

                          {/* Attachment Chips */}
                          {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 px-1">
                              {attachments.map(att => (
                                <div key={att.id} className="group relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg pr-2 pl-3 py-1.5 transition-all hover:bg-white/10">
                                  <div className={`size-2 rounded-full ${att.type.includes('image') ? 'bg-purple-400' : att.type.includes('pdf') ? 'bg-red-400' : 'bg-blue-400'}`} />
                                  <span className="text-[10px] text-slate-300 max-w-[150px] truncate" title={att.name}>{att.name}</span>
                                  <button
                                    onClick={() => !isOptimizing && removeAttachment(att.id)}
                                    className={`ml-1 text-slate-500 hover:text-danger p-0.5 rounded-full ${isOptimizing ? 'cursor-not-allowed opacity-50' : ''}`}
                                    disabled={isOptimizing}
                                  >
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <textarea
                            value={contextData}
                            onChange={(e) => setContextData(e.target.value)}
                            placeholder="Paste relevant background context, rules, or code snippets here to help the AI understand your specific domain..."
                            className={`w-full h-32 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-primary/50 resize-y font-mono ${isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isOptimizing}
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
            {(proposedContent || (optResult && optResult.specStage)) && optResult && (
              <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in duration-500 min-h-0">

                {/* SPECIALIST FLOW VIEWER */}
                {optResult.specStage ? (
                  <SpecStageViewer
                    result={optResult}
                    onAdvance={(msg) => {
                      setChatHistory(prev => [...prev, { role: 'assistant', content: "Stage Output" }, { role: 'user', content: msg }]);
                      handleOptimize(true);
                    }}
                    isBusy={isOptimizing}
                  />
                ) : (
                  /* STANDARD DIFF VIEWER */
                  <div className="flex-1 bg-surface-dark border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl text-left">
                    <div className="bg-black/20 p-3 border-b border-white/5 flex justify-between items-center">
                      <span className="text-xs font-bold text-success flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        Optimization Success
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => { setContent(proposedContent!); setProposedContent(null); }} className="text-[10px] font-bold bg-success/10 text-success px-3 py-1 rounded-full hover:bg-success/20 transition-colors uppercase">Accept</button>
                        <button onClick={() => setProposedContent(null)} className="text-[10px] font-bold bg-white/5 text-slate-400 px-3 py-1 rounded-full hover:bg-white/10 transition-colors uppercase">Dismiss</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <DiffView original={content} modified={proposedContent!} />
                    </div>
                  </div>
                )}

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
                        <ThinkingViewer thinkingProcess={optResult.metadata.thinkingProcess} />
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
