
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
  winner: 'A' | 'B' | 'Tie';
  reasoning: string;
  scoreA: number;
  scoreB: number;
  error?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
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
