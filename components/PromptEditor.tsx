import SyntheticGenerator from './SyntheticGenerator';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizePrompt, runPrompt, ChatMessage, OptimizationResult } from '../services/geminiService';
import { classifyIntent } from '../services/routerService';
import { EvaluationService, EvaluationResult } from '../services/evaluationService';
import { extractVariables, parseContextVariables } from '../utils/promptUtils';
import { EvaluationDashboard } from './EvaluationDashboard';
import { OnboardingTour } from './OnboardingTour';
import { TemplateSelector } from './TemplateSelector';
import { ExportModal } from './ExportModal';
import { ApiKeysModal } from './ApiKeysModal';
import { RichPromptEditor } from './RichPromptEditor';
import { openDirectory, readFileContent } from '../services/fileService';
import { FileItem, Attachment } from '../types';
import SaveVersionModal from './SaveVersionModal';
import DebuggerConsole from './DebuggerConsole';
import DiffView from './DiffView';
import SpecStageViewer from './SpecStageViewer';
import { AI_CONFIG } from '../config/aiConfig';

// REFACTOR: Imported Sub-components
import { EditorSidebar } from './editor/EditorSidebar';
import { EditorToolbar } from './editor/EditorToolbar';
import { ThinkingPanel } from './editor/ThinkingPanel';

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


const PromptEditor: React.FC<Props> = ({
  content,
  setContent,
  onSave,
  onExport,
  onImport,
  addToast,
  contextData,
  setContextData,
  // NEW: Code Context Props (Optional if we want to bubble up, but state is local for now or props?)
  // Let's keep it local or if user wants to persist... the previous code had setContextData in props.
  // The user didn't ask to persist it but it's likely useful.
  // However, for minimal invasion, I'll keep it local or add to props if needed.
  // The existing pattern has setContextData in props.
  // Let's just use local state for now as I can't change the parent easily without reading it. 
  // Wait, I can see PromptEditor definition. 'contextData' is passed in.
  // I'll add a local state for codeContext for now.

  attachments,
  setAttachments
}) => {
  // ZERO-CONFIG STATE
  const [zeroConfigMode, setZeroConfigMode] = useState(true);
  const [inferredType, setInferredType] = useState<string>('');
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(AI_CONFIG.AVAILABLE_MODELS.POWER);

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
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showSyntheticGenerator, setShowSyntheticGenerator] = useState(false);

  // NEW: Code Context State
  const [codeContext, setCodeContext] = useState('');
  const [showCodeContext, setShowCodeContext] = useState(false);


  const [showSaveModal, setShowSaveModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Version Refinement');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);

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

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!content && !isInitialized) return;
    const handler = setTimeout(() => {
      localStorage.setItem('antigravity_active_prompt', content);
      localStorage.setItem('antigravity_chat_history', JSON.stringify(chatHistory));
      if (optResult) localStorage.setItem('antigravity_last_result', JSON.stringify(optResult));
    }, 1000);
    return () => clearTimeout(handler);
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

      onProgress('ROUTER', 'Detectando intención y arquetipo...');
      const historyCtx = historyToUse.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const routerResult = await classifyIntent(content, historyCtx);
      onProgress('ROUTER', `Modo: ${routerResult.mode} | SubTipo: ${routerResult.subType || 'GENERAL'}`);

      let actualSubType = routerResult.subType;

      // ZERO-CONFIG INFERENCE OVERRIDE
      if (zeroConfigMode && !skipInterviewer) {
        // If Zero-Config is ON, we might refine the subType or skip user interview
        // AgentOrchestrator instance for inference
        const { AgentOrchestrator } = await import('../services/agentOrchestrator');
        // Simple heuristic: if we inferred something specific, use it.
        // But logic is cleaner inside optimizePrompt if we pass the flag or handle it here.
        // Let's handle it here:
        const orchestrator = new AgentOrchestrator();
        const inference = await orchestrator.inferTaskType(content);

        // OVERRIDE: If Zero-Config is ON, the user (likely) wants a quick optimization,
        // NOT the full robust Spec Architect Flow (Requirements -> Design -> Tasks).
        // So if inference says 'PLANNING', we downgrade it to 'GENERAL' to keep the standard flow.
        if (inference === 'PLANNING') {
          actualSubType = 'GENERAL';
          setInferredType('PLANNING (Skipped Spec Architect)');
          onProgress('ANALYSIS', `Zero-Config: Planning detected but forcing Standard Flow (Skipping Spec Architect)`);
          addToast('Planning detected: Spec Flow skipped (Zero Config)', 'info');
        } else {
          setInferredType(inference);
          actualSubType = inference;
          onProgress('ANALYSIS', `Zero-Config: Inferred type '${inference}'`);
          addToast(`Auto-Configured: ${inference}`, 'success');
        }
      }

      const result = await optimizePrompt(
        content,
        historyToUse,
        onProgress,
        contextData,
        {
          skipInterviewer: skipInterviewer || zeroConfigMode, // Skip chat in Zero-Config
          model: selectedModel,
          signal: controller.signal,
          attachments,
          subType: actualSubType,
          vibeContext: contextData,
          codeContext: codeContext
        }
      );

      if ('refinedPrompt' in result) {
        // OptimizationResult (Success)
        const optRes = result as OptimizationResult; // Type assertion since it matched property
        setProposedContent(optRes.refinedPrompt);
        setOptResult(optRes);
        if (optRes.partialSuccess) addToast('Recuperación parcial activada.', 'info');
        else addToast('Arquitectura refinada.', 'success');

        if (optRes.metadata.criticScore > 85) {
          setShowReasoning(true);
        }
        setChatHistory([]);
      } else if (result.status === 'NEEDS_CLARIFICATION') {
        const intRes = result; // Explicitly handled
        setChatHistory(prev => [...prev,
        { role: 'user', content },
        { role: 'assistant', content: intRes.clarification_question || '' }
        ]);
        addToast(`IA: ${intRes.clarification_question}`, 'info');
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
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAttachments.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        file: file,
        previewUrl: URL.createObjectURL(file)
      });
    }

    setAttachments([...attachments, ...newAttachments]);
    setIsProcessingFile(false);
    addToast(`${files.length} files attached`, 'success');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      });
    }
  }, [attachments]);

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleEvaluate = async () => {
    if (isBusy || !content.trim()) return;

    setIsEvaluating(true);
    setEvalResult(null);

    try {
      const contextVars = parseContextVariables(contextData);
      const runtimeVars = { ...vars, ...contextVars };

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
      {showSyntheticGenerator && (
        <div className="absolute inset-0 z-50 bg-background-dark/90 p-8 flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-full max-h-[85vh]">
            <SyntheticGenerator onClose={() => setShowSyntheticGenerator(false)} addToast={addToast} />
          </div>
        </div>
      )}
      {showTemplates && <TemplateSelector onSelect={setContent} onClose={() => setShowTemplates(false)} />}
      {showExport && <ExportModal content={content} onClose={() => setShowExport(false)} />}
      {showApiKeysModal && <ApiKeysModal onClose={() => setShowApiKeysModal(false)} />}

      {/* REFACTOR: Sidebar Component */}
      <EditorSidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isBusy={isBusy}
        rootFolder={rootFolder}
        onFileClick={handleFileClick}
      />

      <main className="flex-1 flex flex-col min-w-0">

        {/* REFACTOR: Toolbar Component */}
        <EditorToolbar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setShowTemplates={setShowTemplates}
          handleOpenProject={handleOpenProject}
          currentContent={content}
          proposedContent={proposedContent}
          setShowExport={setShowExport}
          setShowSaveModal={setShowSaveModal}
          setShowSyntheticGenerator={setShowSyntheticGenerator}
          isBusy={isBusy}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          setShowApiKeysModal={setShowApiKeysModal}
        />

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

            {/* ZERO-CONFIG TOGGLE */}
            {!proposedContent && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isOptimizing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${zeroConfigMode ? 'bg-primary/10 border-primary/50' : 'bg-white/5 border-white/10 opacity-60 hover:opacity-100'}`}
                onClick={() => !isOptimizing && setZeroConfigMode(!zeroConfigMode)}
              >
                <div className={`w-8 h-4 rounded-full relative transition-colors ${zeroConfigMode ? 'bg-primary' : 'bg-slate-600'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${zeroConfigMode ? 'left-4.5' : 'left-0.5'}`} style={{ left: zeroConfigMode ? '18px' : '2px' }} />
                </div>
                <span className={`text-[10px] font-bold uppercase ${zeroConfigMode ? 'text-primary' : 'text-slate-400'}`}>
                  Zero-Config Mode {zeroConfigMode && inferredType && <span className="opacity-70">({inferredType})</span>}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6 h-[70vh]">
            {/* LEFT COLUMN: EDITOR */}
            <div className={`flex flex-col transition-all duration-500 ${proposedContent ? 'lg:w-[45%]' : 'w-full'}`}>
              <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col relative group">
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

                    {/* NEW: Code Context Input (Only visible if Zero-Config is OFF) */}
                    {!zeroConfigMode && (
                      <div className="border-b border-white/5 bg-black/20">
                        <button
                          onClick={() => setShowCodeContext(!showCodeContext)}
                          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">code</span>
                            Code Context (Separate)
                          </span>
                          <span className={`material-symbols-outlined text-sm transition-transform ${showCodeContext ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>

                        {showCodeContext && (
                          <div className="p-2 animate-in slide-in-from-top-2">
                            <textarea
                              value={codeContext}
                              onChange={(e) => setCodeContext(e.target.value)}
                              placeholder="Paste only your code here. This helps the AI distinguish between natural language instructions and technical context..."
                              className={`w-full h-32 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-blue-300 focus:outline-none focus:border-secondary/50 resize-y font-mono ${isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={isOptimizing}
                            />
                          </div>
                        )}
                      </div>
                    )}


                    <div className="flex-1 relative">
                      <RichPromptEditor
                        value={content}
                        onChange={setContent}
                        disabled={isBusy}
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 border-t border-white/5 flex flex-col gap-3 bg-background-dark/50 backdrop-blur-sm z-20">

                      {/* REFACTOR: Thinking Panel */}
                      <ThinkingPanel
                        isOptimizing={isOptimizing}
                        progressLog={progressLog}
                        optResult={optResult}
                        showReasoning={showReasoning}
                        setShowReasoning={setShowReasoning}
                      />

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
                            className={`flex-1 bg-gradient-to-r from-primary via-primary-dark to-primary bg-[length:200%_100%] animate-shimmer hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2 group/btn ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                {/* Reasoning Panel Re-used? No, main editor logic has handling above */}
              </div>
            )}
          </div>

          {/* Evaluation Dashboard */}
          {evalResult && (
            <div className="mt-8 animate-in slide-in-from-bottom-4">
              <EvaluationDashboard result={evalResult} isEvaluating={isEvaluating} />
            </div>
          )}

          {/* Console / Test Panel */}
          {consoleOpen && (
            <DebuggerConsole
              isOpen={consoleOpen}
              setIsOpen={setConsoleOpen}
              isTesting={isBusy}
              onClose={() => setConsoleOpen(false)}
              testResult={testResult}
              variables={vars}
              setVariables={setVars}
              onRunTest={handleTest}
              isBusy={isBusy}
            />
          )}

        </div>
      </main >

      {/* Save Modal */}
      {
        showSaveModal && (
          <SaveVersionModal
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSave={(msg, rating) => {
              onSave(msg, rating === null ? undefined : rating);
              setShowSaveModal(false);
            }}
            initialMessage={commitMessage}
          />
        )
      }
    </div >
  );
};

export default PromptEditor;
