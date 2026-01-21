/**
 * VIBE SERVICE
 * Auto-detects the project's Tech Stack and Styling "Vibe".
 * Used to inject context into the Architect so it generates code that matches the project.
 */

// Simple file reading simulation since we can't easily read user's arbitrary FS in browser without FileSystemHandle
// We will rely on "Files" passed from the FileTree or a simple heuristic if running in electron.
// For this web-app demo, we'll simulate detection or read from the 'fileService' if available.

import { FileItem } from '../types';

export interface ProjectVibe {
    framework: string;
    styling: string;
    icons: string;
    language: 'TypeScript' | 'JavaScript';
    notes: string;
}

export const detectVibeFromFiles = async (files: FileItem[]): Promise<ProjectVibe> => {
    // Heuristic Analysis of file list
    const names = files.map(f => f.name);

    let framework = "Vanilla JS";
    if (names.some(n => n === 'next.config.js')) framework = "Next.js";
    else if (names.some(n => n === 'vite.config.ts')) framework = "Vite + React";

    let styling = "CSS";
    if (names.some(n => n.includes('tailwind'))) styling = "Tailwind CSS";

    const language = names.some(n => n.endsWith('.ts') || n.endsWith('.tsx') || n === 'tsconfig.json')
        ? "TypeScript"
        : "JavaScript";

    // Deep detect would need file content reading. 
    // For now, we return a "Best Guess" based on the file tree root.

    return {
        framework,
        styling,
        icons: "Lucide React (Preferred)", // Default preference
        language,
        notes: "Auto-detected from file structure."
    };
};

export const getVibeString = (vibe: ProjectVibe): string => {
    return `
  [DETECTED PROJECT VIBE]
  - **Framework**: ${vibe.framework}
  - **Language**: ${vibe.language}
  - **Styling**: ${vibe.styling} (Use generic utility classes matching standard tokens)
  - **Icons**: ${vibe.icons}
  `.trim();
}
