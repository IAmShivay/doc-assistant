'use client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function WorkspaceSwitcher() {
  const { workspaceList, activeWorkspace, switchWorkspace, loadWorkspaces, apiFetch } = useAuth();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e) {
    e.preventDefault(); if (!newName.trim()) return; setCreating(true);
    try {
      const ws = await apiFetch('/workspaces', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      await loadWorkspaces(); switchWorkspace(ws); setNewName('');
    } catch (err) { alert(err.message); } finally { setCreating(false); }
  }

  return (
    <div>
      <select className="workspace-select" value={activeWorkspace?.id || ''} onChange={e => { const ws = workspaceList.find(w => w.id === e.target.value); if (ws) switchWorkspace(ws); }}>
        {workspaceList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <form className="create-ws-form" onSubmit={handleCreate}>
        <input className="input" placeholder="New workspace..." value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={creating}>+</button>
      </form>
    </div>
  );
}
