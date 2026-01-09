
import React from 'react';

interface SaveVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  commitMessage: string;
  setCommitMessage: (val: string) => void;
  userRating: number | null;
  setUserRating: (val: number | null) => void;
}

const SaveVersionModal: React.FC<SaveVersionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  commitMessage,
  setCommitMessage,
  userRating,
  setUserRating
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background-dark/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md bg-surface-dark border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-modal-title"
      >
        <h3 id="save-modal-title" className="text-xl font-bold mb-2">Seal Prompt Version</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Commit your architectural changes</p>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="commit-msg" className="text-[9px] font-black text-primary uppercase block mb-1.5 ml-1">Change Summary</label>
            <textarea 
              id="commit-msg"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="What's changed in this revision?"
              className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:border-primary/50 resize-none h-24"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2.5 ml-1 text-center">Architectural Confidence Rating</label>
            <div className="flex justify-between gap-1 overflow-x-auto pb-2 hide-scrollbar">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                <button 
                  key={s} 
                  type="button"
                  onClick={() => setUserRating(s)} 
                  className={`flex-1 min-w-[32px] aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all border ${
                    userRating === s 
                      ? 'bg-primary border-primary text-white' 
                      : 'bg-white/5 border-transparent hover:border-white/10 text-slate-500'
                  }`}
                  aria-label={`Calificar con ${s} de 10`}
                  aria-pressed={userRating === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl text-xs hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={onSave}
              className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl text-xs hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all"
            >
              Commit Version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveVersionModal;
