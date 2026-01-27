
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PromptBlueprint {
  persona: string;
  task: string;
  context: string;
  constraints: string;
  outputFormat: string;
  fewShot: string[];
}

export interface PromptVersion {
  id: string;
  version: string;
  tag: string;
  message: string;
  content: string;
  blueprint?: PromptBlueprint;
  author: string;
  timestamp: string;
  hash: string;
  rating?: number;
}

export interface BattleResult {
  winner: 'A' | 'B' | 'Tie' | 'Inconclusive';
  reasoning: string;
  scoreA: number;
  scoreB: number;
  error?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export interface TestCase {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  metrics?: {
    faithfulness: number;
    relevance: number;
    coherence: number;
    latency: string;
    cost: string;
    faithfulnessRatio: string;
  };
  reasoning?: string;
}

// Fase 1: Saneamiento de Tipos - File System API
export interface FileItem {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileItem[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  data?: string; // base64 (Optional now, used for API)
  file?: File; // Raw file for performance
  previewUrl?: string; // ObjectURL for UI
}

export interface SavedComparison {
  id: string;
  timestamp: string;
  promptA: string;
  promptB: string;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | 'Tie' | 'Inconclusive';
}

// --- Signature Composer Types ---

export interface SignatureField {
  id: string; // for React keys
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'list';
  description?: string;
  required: boolean;
}

export interface ReasoningStep {
  id: string;
  type: 'CoT' | 'ReAct' | 'Reflexion';
  description: string;
}

export interface AgentSignature {
  name: string;
  description: string;
  inputs: SignatureField[];
  steps: ReasoningStep[];
  outputs: SignatureField[];
}
