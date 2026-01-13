
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PromptVersion } from '../types';
import { ShareService } from '../services/shareService';

interface Props {
  versions: PromptVersion[];
  onRevert: (v: PromptVersion) => void;
  onDelete: (id: string) => void;
}

const History: React.FC<Props> = ({ versions, onRevert, onDelete }) => {
  const navigate = useNavigate();
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedLink, setSharedLink] = useState<string | null>(null);

  const handleShare = async (id: string) => {
    setSharingId(id);
    try {
      const token = await ShareService.publishVersion(id);
      const link = `${window.location.origin}/#/share/${token}`;
      await navigator.clipboard.writeText(link);
      setSharedLink(link);
      setTimeout(() => setSharedLink(null), 3000); // Reset after 3s
    } catch (err) {
      console.error(err);
    } finally {
      setSharingId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 3) return 'text-danger bg-danger/10 border-danger/20';
    if (score <= 7) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-success bg-success/10 border-success/20';
  };

  return (
    <div className="flex flex-col h-full bg-background-dark">
      <header className="sticky top-0 z-20 bg-background-dark/90 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-3xl flex items-center gap-4">
          <button onClick={() => navigate('/')} className="size-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <h2 className="text-sm font-bold">Version History</h2>
        </div>
      </header>

      {versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
          <p>No saved versions yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4 max-w-3xl">
            {versions.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[32px_1fr] gap-x-4">
                <div className="flex flex-col items-center pt-1">
                  <div className={`flex items-center justify-center rounded-full size-8 ${i === 0 ? 'bg-primary/20 ring-2 ring-primary/20' : 'bg-surface-dark border-white/10'}`}>
                    <span className="material-symbols-outlined text-sm">{i === 0 ? 'check' : 'history'}</span>
                  </div>
                  {i !== versions.length - 1 && <div className="w-[1px] bg-white/5 h-full grow my-2"></div>}
                </div>
                <div className="flex flex-col pb-4">
                  <div className="bg-surface-dark rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-all shadow hover:shadow-primary/5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">{v.version}</span>
                      <div className="flex items-center gap-2">
                        {v.rating !== undefined && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${getScoreColor(v.rating)}`}>
                            <span className="material-symbols-outlined text-[10px] fill-1">star</span>
                            {v.rating}/10
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">{v.hash}</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold mb-1 text-white">{v.message}</h3>
                    <p className="text-xs text-slate-400 mb-3 line-clamp-4 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 font-mono whitespace-pre-wrap break-words">"{v.content}"</p>
                    <div className="flex gap-2">
                      <button onClick={() => { onRevert(v); navigate('/'); }} className="flex-1 py-2 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-primary/20 transition-all">Restore</button>

                      {/* Share Button */}
                      <button
                        onClick={() => handleShare(v.id)}
                        className={`flex-1 py-2 ${sharedLink && sharingId === v.id ? 'bg-success/10 text-success' : 'bg-cyan-500/10 text-cyan-400'} text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all`}
                        disabled={sharingId === v.id}
                      >
                        {sharingId === v.id ? 'Generating...' : (sharedLink && sharingId === v.id ? 'Link Copied' : 'Share Link')}
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this version?')) {
                            onDelete(v.id);
                          }
                        }}
                        className="w-8 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 flex items-center justify-center transition-colors border border-transparent hover:border-danger/30"
                        title="Delete Version"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2 px-1">By {v.author} • {new Date(v.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
