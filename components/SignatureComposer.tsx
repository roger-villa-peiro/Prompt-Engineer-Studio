
import React, { useState, useEffect } from 'react';
import { AgentSignature, SignatureField, ReasoningStep } from '../types';
import { compileSignatureToPrompt } from '../utils/signatureCompiler';

interface SignatureComposerProps {
    onSave: (prompt: string) => void;
    onCancel: () => void;
}

const emptySignature: AgentSignature = {
    name: 'New Agent',
    description: 'Describe what this agent does...',
    inputs: [],
    steps: [],
    outputs: []
};

const SignatureComposer: React.FC<SignatureComposerProps> = ({ onSave, onCancel }) => {
    const [signature, setSignature] = useState<AgentSignature>(emptySignature);
    const [preview, setPreview] = useState<string>('');

    useEffect(() => {
        setPreview(compileSignatureToPrompt(signature));
    }, [signature]);

    const addInput = () => {
        const newField: SignatureField = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'new_input',
            type: 'string',
            required: true,
            description: ''
        };
        setSignature(prev => ({ ...prev, inputs: [...prev.inputs, newField] }));
    };

    const updateInput = (id: string, updates: Partial<SignatureField>) => {
        setSignature(prev => ({
            ...prev,
            inputs: prev.inputs.map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const removeInput = (id: string) => {
        setSignature(prev => ({
            ...prev,
            inputs: prev.inputs.filter(f => f.id !== id)
        }));
    };

    const addStep = () => {
        const newStep: ReasoningStep = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'CoT',
            description: 'Analyze the step...'
        };
        setSignature(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    };

    const updateStep = (id: string, updates: Partial<ReasoningStep>) => {
        setSignature(prev => ({
            ...prev,
            steps: prev.steps.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    };

    const removeStep = (id: string) => {
        setSignature(prev => ({
            ...prev,
            steps: prev.steps.filter(s => s.id !== id)
        }));
    };

    const addOutput = () => {
        const newField: SignatureField = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'result',
            type: 'string',
            required: true
        };
        setSignature(prev => ({ ...prev, outputs: [...prev.outputs, newField] }));
    };

    const updateOutput = (id: string, updates: Partial<SignatureField>) => {
        setSignature(prev => ({
            ...prev,
            outputs: prev.outputs.map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const removeOutput = (id: string) => {
        setSignature(prev => ({
            ...prev,
            outputs: prev.outputs.filter(f => f.id !== id)
        }));
    };

    return (
        <div className="flex h-screen bg-[#030712] text-gray-200 font-sans overflow-hidden">
            {/* Left Panel: Editor */}
            <div className="w-1/2 flex flex-col border-r border-white/10 overflow-y-auto custom-scrollbar">
                <div className="p-6 space-y-8">

                    {/* Header */}
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={signature.name}
                            onChange={e => setSignature({ ...signature, name: e.target.value })}
                            className="text-4xl font-bold bg-transparent border-b border-cyan-500/50 focus:border-cyan-400 outline-none w-full text-cyan-50 placeholder-white/20 font-mono tracking-tight"
                        />
                        <textarea
                            value={signature.description}
                            onChange={e => setSignature({ ...signature, description: e.target.value })}
                            className="w-full bg-white/5 rounded-lg p-3 border border-white/10 focus:border-cyan-500/50 outline-none resize-none h-24 text-sm"
                            placeholder="Describe the agent's task..."
                        />
                    </div>

                    {/* Section: Inputs */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                            <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">input</span> INPUTS
                            </h3>
                            <button onClick={addInput} className="text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded transition-colors uppercase font-bold tracking-wider">
                                + Add Input
                            </button>
                        </div>
                        <div className="space-y-3">
                            {signature.inputs.map(field => (
                                <div key={field.id} className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            className="bg-black/20 rounded px-2 py-1 text-sm font-mono text-cyan-200 w-1/3 border border-transparent focus:border-cyan-500/30 outline-none"
                                            value={field.name}
                                            onChange={e => updateInput(field.id, { name: e.target.value })}
                                            placeholder="field_name"
                                        />
                                        <select
                                            className="bg-black/20 rounded px-2 py-1 text-xs text-gray-400 outline-none w-1/4"
                                            value={field.type}
                                            onChange={e => updateInput(field.id, { type: e.target.value as any })}
                                        >
                                            <option value="string">String</option>
                                            <option value="json">JSON</option>
                                            <option value="list">List</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                        </select>
                                        <div className="flex-1"></div>
                                        <button onClick={() => removeInput(field.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                    <input
                                        className="w-full bg-transparent text-xs text-gray-500 placeholder-gray-700 outline-none"
                                        placeholder="Description of this input..."
                                        value={field.description || ''}
                                        onChange={e => updateInput(field.id, { description: e.target.value })}
                                    />
                                </div>
                            ))}
                            {signature.inputs.length === 0 && <div className="text-gray-700 text-xs italic text-center py-4">No inputs defined</div>}
                        </div>
                    </div>

                    {/* Section: Logic */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                            <h3 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">psychology</span> LOGIC
                            </h3>
                            <button onClick={addStep} className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-1 rounded transition-colors uppercase font-bold tracking-wider">
                                + Add Step
                            </button>
                        </div>
                        <div className="space-y-3">
                            {signature.steps.map((step, idx) => (
                                <div key={step.id} className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-amber-500/20 transition-colors relative">
                                    <div className="absolute -left-3 top-3 w-6 h-6 bg-amber-900/50 text-amber-500 rounded-full flex items-center justify-center text-xs font-bold border border-amber-500/30">
                                        {idx + 1}
                                    </div>
                                    <div className="flex gap-2 items-center mb-2 pl-4">
                                        <select
                                            className="bg-black/20 rounded px-2 py-1 text-xs text-amber-200 outline-none font-bold uppercase tracking-wider"
                                            value={step.type}
                                            onChange={e => updateStep(step.id, { type: e.target.value as any })}
                                        >
                                            <option value="CoT">Chain of Thought</option>
                                            <option value="ReAct">ReAct</option>
                                            <option value="Reflexion">Reflexion</option>
                                        </select>
                                        <div className="flex-1"></div>
                                        <button onClick={() => removeStep(step.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full bg-black/20 rounded p-2 text-sm text-gray-300 placeholder-gray-700 outline-none resize-none h-16 ml-4 w-[calc(100%-1rem)]"
                                        placeholder="Describe what the agent should do in this step..."
                                        value={step.description}
                                        onChange={e => updateStep(step.id, { description: e.target.value })}
                                    />
                                </div>
                            ))}
                            {signature.steps.length === 0 && <div className="text-gray-700 text-xs italic text-center py-4">No logic steps defined</div>}
                        </div>
                    </div>

                    {/* Section: Outputs */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">output</span> OUTPUTS
                            </h3>
                            <button onClick={addOutput} className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-1 rounded transition-colors uppercase font-bold tracking-wider">
                                + Add Output
                            </button>
                        </div>
                        <div className="space-y-3">
                            {signature.outputs.map(field => (
                                <div key={field.id} className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex gap-2">
                                        <input
                                            className="bg-black/20 rounded px-2 py-1 text-sm font-mono text-emerald-200 w-1/3 border border-transparent focus:border-emerald-500/30 outline-none"
                                            value={field.name}
                                            onChange={e => updateOutput(field.id, { name: e.target.value })}
                                            placeholder="result_field"
                                        />
                                        <select
                                            className="bg-black/20 rounded px-2 py-1 text-xs text-gray-400 outline-none w-1/4"
                                            value={field.type}
                                            onChange={e => updateOutput(field.id, { type: e.target.value as any })}
                                        >
                                            <option value="string">String</option>
                                            <option value="json">JSON</option>
                                            <option value="list">List</option>
                                            <option value="boolean">Boolean</option>
                                        </select>
                                        <div className="flex-1"></div>
                                        <button onClick={() => removeOutput(field.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {signature.outputs.length === 0 && <div className="text-gray-700 text-xs italic text-center py-4">No outputs defined</div>}
                        </div>
                    </div>

                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="w-1/2 flex flex-col bg-black/20">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-sm font-bold text-gray-400 tracking-wider uppercase">Compiled Prompt Preview</h2>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(preview)}
                            className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
                        >
                            Export to Editor
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-6 overflow-auto custom-scrollbar">
                    <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap bg-black/40 p-6 rounded-lg border border-white/5 h-full">
                        {preview}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SignatureComposer;
