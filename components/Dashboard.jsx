'use client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import DocumentList from './DocumentList';
import Chat from './Chat';
import ToolLog from './ToolLog';

export default function Dashboard() {
  const { user, logout, activeWorkspace } = useAuth();
  const [view, setView] = useState('chat');
  const navItems = [{ id: 'chat', label: 'Chat' }, { id: 'documents', label: 'Documents' }, { id: 'tools', label: 'Tool Logs & Tasks' }];

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-header"><h1>Doc Assistant</h1></div>
        <div className="sidebar-section"><h3>Workspace</h3><WorkspaceSwitcher /></div>
        <div className="sidebar-nav">{navItems.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.label}</button>)}</div>
        <div className="sidebar-section" style={{ borderTop: '1px solid var(--border)' }}><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{user.email}</div><button className="btn btn-secondary btn-sm" onClick={logout} style={{ width: '100%' }}>Sign Out</button></div>
      </div>
      <div className="main-content">
        <div className="top-bar"><h2>{activeWorkspace?.name || 'No workspace'} — {navItems.find(n => n.id === view)?.label}</h2></div>
        {view === 'chat' ? <Chat /> : <div className="content-area">{view === 'documents' && <DocumentList />}{view === 'tools' && <ToolLog />}</div>}
      </div>
    </div>
  );
}
