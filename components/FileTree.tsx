
import React from 'react';
import { FileItem } from '../types';

interface FileTreeProps {
  items: FileItem[];
  onFileClick: (handle: FileSystemFileHandle) => void;
  disabled?: boolean;
}

/**
 * Memoized FileTree component to prevent re-renders when editor content changes.
 * Uses semantic buttons for accessibility.
 * Now includes a 'disabled' state to prevent race conditions during async operations.
 */
const FileTree: React.FC<FileTreeProps> = React.memo(({ items, onFileClick, disabled }) => {
  return (
    <div 
      className={`pl-3 space-y-1 transition-opacity duration-200 ${disabled ? 'pointer-events-none opacity-50' : ''}`} 
      role="tree"
      aria-disabled={disabled}
    >
      {items.map(item => (
        <div key={item.name} role="none">
          {item.kind === 'file' ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onFileClick(item.handle as FileSystemFileHandle)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all text-left disabled:cursor-not-allowed"
              role="treeitem"
              aria-label={`Abrir archivo ${item.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              <span className="truncate">{item.name}</span>
            </button>
          ) : (
            <div className="flex flex-col" role="group">
              <div className="flex items-center gap-2 p-1.5 text-xs text-slate-500 font-bold select-none">
                <span className="material-symbols-outlined text-[16px]">folder</span>
                <span className="truncate">{item.name}</span>
              </div>
              {item.children && item.children.length > 0 && (
                <FileTree items={item.children} onFileClick={onFileClick} disabled={disabled} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

FileTree.displayName = 'FileTree';

export default FileTree;
