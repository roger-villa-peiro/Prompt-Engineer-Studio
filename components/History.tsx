
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
      <header className="sticky top-0 z-20 flex items-center bg-background-dark/90 backdrop-blur-md p-4 border-b border-white/5">
        <button onClick={() => navigate('/')} className="size-10 flex items-center justify-center rounded-full hover:bg-white/10">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="flex-1 text-center text-lg font-bold pr-10">Version History</h2>
      </header>

      {versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
          <p>No saved versions yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 space-y-6">
          {versions.map((v, i) => (
            <div key={v.id} className="grid grid-cols-[32px_1fr] gap-x-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`flex items-center justify-center rounded-full size-8 ${i === 0 ? 'bg-primary/20 ring-2 ring-primary' : 'bg-surface-dark border-white/10'}`}>
                  <span className="material-symbols-outlined text-[18px]">{i === 0 ? 'check' : 'history'}</span>
                </div>
                {i !== versions.length - 1 && <div className="w-[1px] bg-white/5 h-full grow my-2"></div>}
              </div>
              <div className="flex flex-col pb-6">
                <div className="bg-surface-dark rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{v.version}</span>
                    <div className="flex items-center gap-2">
                      {v.rating !== undefined && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black ${getScoreColor(v.rating)}`}>
                          <span className="material-symbols-outlined text-[10px] fill-1">star</span>
                          {v.rating}/10
                        </div>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">{v.hash}</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold mb-1">{v.message}</h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2 italic">"{v.content}"</p>
                  <div className="flex gap-2">
                    <button onClick={() => { onRevert(v); navigate('/'); }} className="flex-1 py-2 bg-primary/10 text-primary text-[10px] font-bold rounded-lg hover:bg-primary/20">Restore</button>

                    {/* Share Button */}
                    <button
                      onClick={() => handleShare(v.id)}
                      className={`flex-1 py-2 ${sharedLink && sharingId === v.id ? 'bg-success/10 text-success' : 'bg-cyan-500/10 text-cyan-400'} text-[10px] font-bold rounded-lg transition-all`}
                      disabled={sharingId === v.id}
                    >
                      {sharingId === v.id ? 'Generating...' : (sharedLink && sharingId === v.id ? 'Copied Link!' : 'Share Link')}
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this version?')) {
                          onDelete(v.id);
                        }
                      }}
                      className="w-8 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 flex items-center justify-center transition-colors"
                      title="Delete Version"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 px-1">By {v.author} • {v.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
