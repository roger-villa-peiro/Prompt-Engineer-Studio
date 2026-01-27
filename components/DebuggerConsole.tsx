
import React from 'react';

interface DebuggerConsoleProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  onClose?: () => void;
  isTesting: boolean;
  testResult: string;
  variables: Record<string, string>;
  setVariables: (val: Record<string, string>) => void;
  onRunTest: () => void;
  isBusy: boolean;
}

const DebuggerConsole: React.FC<DebuggerConsoleProps> = ({
  isOpen,
  setIsOpen,
  onClose,
  isTesting,
  testResult,
  variables,
  setVariables,
  onRunTest,
  isBusy
}) => {
  return (
    <section className="fixed bottom-0 left-0 w-full z-40 p-4 pointer-events-none" aria-label="Consola de depuración">
      <div className="max-w-md mx-auto pointer-events-auto bg-surface-dark/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <button
          onClick={() => {
            if (onClose) onClose();
            setIsOpen(!isOpen);
          }}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors border-b border-white/5 shrink-0 outline-none focus-visible:bg-white/5"
          aria-expanded={isOpen}
          aria-controls="console-content"
        >
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined ${isTesting ? 'animate-spin' : 'text-primary'}`}>{isTesting ? 'sync' : 'terminal'}</span>
            <span className="text-sm font-bold uppercase tracking-widest">Debugger Console</span>
          </div>
          <span className={`material-symbols-outlined text-slate-500 transition-transform ${isOpen ? '' : 'rotate-180'}`}>keyboard_arrow_down</span>
        </button>

        {isOpen && (
          <div id="console-content" className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5 hide-scrollbar">
              <div className="space-y-4">
                {Object.keys(variables).map(k => (
                  <div key={k} className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-primary uppercase tracking-tighter">Value: {k}</label>
                    <textarea
                      value={variables[k]}
                      onChange={e => setVariables({ ...variables, [k]: e.target.value })}
                      placeholder={`Paste test context for ${k}...`}
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary/50 resize-none h-20"
                    />
                  </div>
                ))}
                {Object.keys(variables).length === 0 && (
                  <p className="text-[10px] text-slate-500 text-center py-4 italic">No variables detected. Testing static prompt.</p>
                )}
              </div>

              {testResult && (
                <div className="mt-6 border-t border-white/10 pt-6 animate-in fade-in">
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-3 block">Model Output</span>
                  <div className="p-5 bg-black/40 border border-white/5 rounded-2xl text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {testResult}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-black/40 border-t border-white/5 flex gap-3">
              <button
                onClick={onRunTest}
                disabled={isBusy}
                className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isTesting ? 'sync' : 'bolt'}</span>
                {isTesting ? 'Synthesizing...' : 'Run Bench Run'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DebuggerConsole;
