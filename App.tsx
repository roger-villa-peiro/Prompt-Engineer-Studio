
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import PromptEditor from './components/PromptEditor';
import History from './components/History';
import ExperimentConfig from './components/ExperimentConfig';
import EvaluationResults from './components/EvaluationResults';
import PromptBattle from './components/PromptBattle';
import { ComparisonView } from './components/ComparisonView';
import { SharedPromptView } from './components/SharedPromptView';
import { PromptVersion, ToastMessage } from './types';
import { supabase } from './src/services/supabaseClient';

const App: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const [currentPrompt, setCurrentPrompt] = useState<string>(() => {
    return localStorage.getItem('activePrompt') || 'New Prompt...';
  });

  const [versions, setVersions] = useState<PromptVersion[]>([]);

  // Local Persistence for Active Prompt Only
  useEffect(() => {
    localStorage.setItem('activePrompt', currentPrompt);
  }, [currentPrompt]);

  const [contextData, setContextData] = useState<string>(() => {
    return localStorage.getItem('globalContext') || '';
  });

  useEffect(() => {
    localStorage.setItem('globalContext', contextData);
  }, [contextData]);

  // Load Versions from Supabase
  useEffect(() => {
    const fetchVersions = async () => {
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching versions:', error);
        addToast('Failed to sync history from cloud', 'error');
      } else if (data) {
        // Map Supabase layout to internal type
        const mapped: PromptVersion[] = data.map(d => ({
          id: d.id,
          version: d.version_label || 'v1.0',
          tag: 'Cloud',
          message: d.version_label || 'Cloud Version',
          content: d.content,
          author: d.author || 'User',
          timestamp: d.created_at,
          hash: 'synced',
          rating: 0
        }));
        setVersions(mapped);
      }
    };

    fetchVersions();
  }, [addToast]);

  const saveVersion = async (message: string, rating?: number) => {
    const versionLabel = `v1.${versions.length + 1}`;

    // Optimistic UI Update
    const optimisticVersion: PromptVersion = {
      id: "pending-" + Math.random(),
      version: versionLabel,
      tag: 'Saving...',
      message: message || 'Untitled Refinement',
      content: currentPrompt,
      author: 'You',
      timestamp: new Date().toISOString(),
      hash: 'pending',
      rating: rating
    };
    setVersions(prev => [optimisticVersion, ...prev]);

    try {
      const { data, error } = await supabase
        .from('prompt_versions')
        .insert({
          content: currentPrompt,
          version_label: message || versionLabel,
          author: 'User',
          metadata: { rating, source: 'antigravity-architect' }
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic with real data
      setVersions(prev => prev.map(v => v.id === optimisticVersion.id ? {
        ...optimisticVersion,
        id: data.id,
        tag: 'Cloud',
        timestamp: data.created_at
      } : v));

      addToast('Version securely saved to Cloud', 'success');
    } catch (err: any) {
      console.error('Error saving to Supabase:', err);
      addToast('Failed to save to cloud: ' + err.message, 'error');
      // Rollback optimistic update if needed, or leave as 'Error' state
    }
  };

  const deleteVersion = async (id: string) => {
    setVersions(prev => prev.filter(v => v.id !== id)); // Optimistic delete

    const { error } = await supabase
      .from('prompt_versions')
      .delete()
      .eq('id', id);

    if (error) {
      addToast('Failed to delete from cloud', 'error');
      // In a real app, we would revert the state here
    } else {
      addToast('Version deleted from Cloud', 'info');
    }
  };

  const exportLibrary = () => {
    const data = JSON.stringify({ currentPrompt, versions }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-studio-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    addToast('Library exported', 'info');
  };

  const importLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.versions) setVersions(data.versions); // Needs careful merging with cloud
        if (data.currentPrompt) setCurrentPrompt(data.currentPrompt);
        addToast('Library imported (Local Session Only)', 'success');
      } catch (err) {
        addToast('Invalid library file', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <HashRouter>
      <div className="h-screen bg-background-dark text-white font-sans overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={
            <PromptEditor
              content={currentPrompt}
              setContent={setCurrentPrompt}
              onSave={saveVersion}
              onExport={exportLibrary}
              onImport={importLibrary}
              addToast={addToast}
              contextData={contextData}
              setContextData={setContextData}
            />
          } />
          <Route path="/versions" element={
            <History
              versions={versions}
              onRevert={(v) => { setCurrentPrompt(v.content); addToast('Prompt restored', 'info'); }}
              onDelete={deleteVersion}
            />
          } />
          <Route path="/experiment/new" element={<ExperimentConfig currentPrompt={currentPrompt} />} />
          <Route path="/experiment/results" element={<EvaluationResults />} />
          <Route path="/battle" element={<PromptBattle versions={versions} addToast={addToast} />} />
          <Route path="/compare" element={<ComparisonView />} />
          <Route path="/share/:token" element={
            <SharedPromptView onFork={(content) => {
              setCurrentPrompt(content);
              addToast('Prompt forked to workspace', 'success');
            }} />
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* Global Toast System */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map(toast => (
            <div key={toast.id} className={`pointer-events-auto px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-success/10 border-success text-success' :
              toast.type === 'error' ? 'bg-danger/10 border-danger text-danger' :
                'bg-primary/10 border-primary text-primary'
              }`}>
              <span className="material-symbols-outlined text-[18px]">
                {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
              </span>
              <span className="text-sm font-bold">{toast.text}</span>
            </div>
          ))}
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
