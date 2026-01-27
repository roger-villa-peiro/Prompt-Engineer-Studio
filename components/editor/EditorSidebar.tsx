import React from 'react';
import FileTree from '../FileTree';
import { FileItem } from '../../types';

interface EditorSidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    isBusy: boolean;
    rootFolder: FileItem | null;
    onFileClick: (handle: FileSystemFileHandle) => void;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
    isOpen,
    setIsOpen,
    isBusy,
    rootFolder,
    onFileClick
}) => {
    return (
        <aside className={`transition-all duration-300 border-r border-white/5 bg-background-dark flex flex-col overflow-hidden ${isOpen ? 'w-64' : 'w-0'}`}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[16rem]">
                <span className="text-[10px] font-black uppercase text-slate-500">Project Files</span>
                <button
                    onClick={() => setIsOpen(false)}
                    className="size-6 flex items-center justify-center rounded-full hover:bg-white/10"
                    disabled={isBusy}
                >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 min-w-[16rem]">
                {rootFolder && <FileTree items={rootFolder.children || []} onFileClick={onFileClick} disabled={isBusy} />}
            </div>
        </aside>
    );
};
