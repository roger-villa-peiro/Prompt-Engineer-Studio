import React, { useState, useEffect, useRef } from 'react';
import { SwarmService, SwarmState, AgentMessage } from '../../services/swarmService';
import { DeploymentService, DeploymentLog } from '../../services/deploymentService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const AgentWorkspace: React.FC = () => {
    const [objective, setObjective] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [swarmState, setSwarmState] = useState<SwarmState | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    // DEPLOYMENT STATE
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployLogs, setDeployLogs] = useState<DeploymentLog[]>([]);
    const [deployUrl, setDeployUrl] = useState<string | null>(null);

    const swarmRef = useRef<SwarmService | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [swarmState?.messages, deployLogs]);

    const startSwarm = async () => {
        if (!objective.trim()) return;
        setIsRunning(true);
        setDeployLogs([]);
        setDeployUrl(null);

        const swarm = new SwarmService(objective);
        swarmRef.current = swarm;
        setSwarmState(swarm['state']); // Access initial state

        try {
            await swarm.run((updatedState) => {
                setSwarmState({ ...updatedState });
            });
        } catch (error) {
            console.error("Swarm failed:", error);
        } finally {
            setIsRunning(false);
        }
    };

    const handleDeploy = async () => {
        if (!swarmState?.files || Object.keys(swarmState.files).length === 0) return;

        setIsDeploying(true);
        setDeployLogs([]);
        setDeployUrl(null);

        const result = await DeploymentService.deploy(
            'swarm-' + swarmState.id,
            swarmState.files,
            (log) => setDeployLogs(prev => [...prev, log])
        );

        if (result.success && result.url) {
            setDeployUrl(result.url);
        }
        setIsDeploying(false);
    };

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-purple-100 font-sans overflow-hidden">

            {/* LEFT SIDEBAR: PLAN & FILES */}
            <div className="w-80 bg-surface-dark border-r border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <h2 className="font-bold text-sm tracking-widest text-purple-400">AGENT SWARM</h2>
                    <div className="text-xs text-slate-500 mt-1">Loki-Mode Architecture</div>
                </div>

                {/* PLAN */}
                <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase">Execution Plan</h3>
                    {swarmState?.plan.length ? (
                        <ul className="space-y-2">
                            {swarmState.plan.map((step, i) => (
                                <li key={i} className="text-xs flex gap-2">
                                    <span className="text-purple-500 font-mono">{i + 1}.</span>
                                    <span className="opacity-80 leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-xs text-slate-600 italic">No plan yet...</div>
                    )}
                </div>

                {/* FILES */}
                <div className="h-1/3 border-t border-white/5 p-4 overflow-y-auto flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase">Generated Files</h3>
                        {swarmState?.files && Object.keys(swarmState.files).length > 0 && (
                            <button
                                onClick={handleDeploy}
                                disabled={isDeploying || isRunning}
                                className="text-[10px] bg-green-600/20 text-green-400 border border-green-600/50 px-2 py-1 rounded hover:bg-green-600/30 transition-all uppercase font-bold disabled:opacity-50"
                            >
                                {isDeploying ? 'Deploying...' : 'Deploy'}
                            </button>
                        )}
                    </div>
                    {swarmState?.files && Object.keys(swarmState.files).length > 0 ? (
                        <ul className="space-y-1">
                            {Object.keys(swarmState.files).map(file => (
                                <li
                                    key={file}
                                    className={`text-xs cursor-pointer px-2 py-1.5 rounded hover:bg-white/5 ${selectedFile === file ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400'}`}
                                    onClick={() => setSelectedFile(file)}
                                >
                                    📄 {file}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-xs text-slate-600 italic">No files generated.</div>
                    )}
                </div>
            </div>

            {/* CENTER: CHAT / MAIN AREA */}
            <div className="flex-1 flex flex-col relative">
                {/* HEADER */}
                <div className="h-14 border-b border-white/5 flex items-center px-6 justify-between bg-surface-dark/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                        <span className="text-sm font-medium">
                            {isRunning ? `Status: ${swarmState?.status}` : 'Idle'}
                        </span>
                    </div>
                </div>

                {/* CHAT MESSAGES */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!swarmState ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                            <span className="material-symbols-outlined text-6xl mb-4">groups_3</span>
                            <p className="max-w-md">Enter an objective to spawn an Agent Swarm. The Manager will plan, Architect will design, Engineer will code, and QA will review.</p>
                        </div>
                    ) : (
                        <>
                            {swarmState.messages.map((msg, idx) => (
                                <div key={idx} className={`flex flex-col gap-2 ${msg.role === 'MANAGER' ? 'items-center' : 'items-start'}`}>

                                    {/* ROLE BADGE */}
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${msg.role === 'MANAGER' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                            msg.role === 'ARCHITECT' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                                msg.role === 'ENGINEER' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                                    'bg-red-500/10 border-red-500/30 text-red-400' // QA
                                        }`}>
                                        {msg.role}
                                    </div>

                                    {/* CONTENT */}
                                    <div className={`text-sm leading-relaxed p-4 rounded-2xl bg-white/5 border border-white/5 max-w-3xl ${msg.role === 'MANAGER' ? 'text-center' : ''}`}>
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}

                            {/* DEPLOYMENT LOGS OVERLAY */}
                            {(isDeploying || deployLogs.length > 0) && (
                                <div className="mt-8 p-4 bg-black/40 rounded-xl border border-white/10 font-mono text-xs max-h-60 overflow-y-auto animate-in slide-in-from-bottom-2">
                                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/80 p-2 -mx-2 -mt-2 border-b border-white/5 z-10">
                                        <span className="font-bold text-slate-400">DEPLOYMENT LOGS</span>
                                        {deployUrl && (
                                            <a href={deployUrl} target="_blank" rel="noreferrer" className="text-green-400 hover:underline flex items-center gap-1">
                                                Open App <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                            </a>
                                        )}
                                        {!isDeploying && <button onClick={() => setDeployLogs([])} className="text-slate-500 hover:text-white">Clear</button>}
                                    </div>
                                    <div className="space-y-1">
                                        {deployLogs.map((log, i) => (
                                            <div key={i} className={`flex gap-2 ${log.level === 'ERROR' ? 'text-red-400' :
                                                    log.level === 'SUCCESS' ? 'text-green-400' :
                                                        log.level === 'WARN' ? 'text-yellow-400' : 'text-slate-300'
                                                }`}>
                                                <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </>
                    )}
                </div>

                {/* INPUT AREA */}
                <div className="p-4 border-t border-white/5 bg-surface-dark">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-slate-600"
                            placeholder={isRunning ? "Swarm is running..." : "Describe your app idea (e.g., 'Create a React Todo app with local storage')"}
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            disabled={isRunning}
                            onKeyDown={(e) => e.key === 'Enter' && startSwarm()}
                        />
                        <button
                            onClick={startSwarm}
                            disabled={isRunning || !objective.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl font-medium transition-all"
                        >
                            {isRunning ? 'Running...' : 'Spawn Swarm'}
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: FILE PREVIEW (Conditional) */}
            {selectedFile && swarmState?.files[selectedFile] && (
                <div className="w-96 border-l border-white/5 bg-[#1e1e1e] flex flex-col shadow-2xl animate-in slide-in-from-right-10">
                    <div className="p-3 border-b border-white/5 flex justify-between items-center bg-[#252526]">
                        <span className="text-xs font-mono">{selectedFile}</span>
                        <button onClick={() => setSelectedFile(null)} className="text-slate-500 hover:text-white">✕</button>
                    </div>
                    <div className="flex-1 overflow-auto text-xs">
                        <SyntaxHighlighter
                            language={selectedFile.endsWith('ts') || selectedFile.endsWith('tsx') ? 'typescript' : 'javascript'}
                            style={vscDarkPlus}
                            customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                        >
                            {swarmState.files[selectedFile]}
                        </SyntaxHighlighter>
                    </div>
                </div>
            )}

        </div>
    );
};
