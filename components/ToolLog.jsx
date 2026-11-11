'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ToolLog() {
  const { activeWorkspace, apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('logs');

  useEffect(() => { if (activeWorkspace) { loadLogs(); loadTasks(); } }, [activeWorkspace?.id]);
  async function loadLogs() { try { setLogs(await apiFetch(`/chat/${activeWorkspace.id}/tool-logs`)); } catch {} }
  async function loadTasks() { try { setTasks(await apiFetch(`/chat/${activeWorkspace.id}/tasks`)); } catch {} }

  if (!activeWorkspace) return <div className="empty-state"><h3>Select a workspace</h3></div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('logs')}>Tool Logs</button>
        <button className={`btn ${tab === 'tasks' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('tasks')}>Tasks ({tasks.length})</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { loadLogs(); loadTasks(); }}>Refresh</button>
      </div>
      {tab === 'logs' && (<div>{logs.length === 0 ? <div className="empty-state"><h3>No tool calls yet</h3></div> : logs.map(log => (
        <div key={log.id} className="tool-log-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="tool-name">{log.tool_name}</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className={`badge ${log.success ? 'badge-success' : 'badge-danger'}`}>{log.success ? 'Success' : 'Failed'}</span><span className="tool-time">{new Date(log.created_at).toLocaleString()}</span></div></div>
          <div className="tool-args">Args: {JSON.stringify(log.args)}</div>
          <div className={`tool-result ${log.success ? '' : 'failed'}`}>Result: {JSON.stringify(log.result)}</div>
        </div>))}</div>)}
      {tab === 'tasks' && (<div className="task-list">{tasks.length === 0 ? <div className="empty-state"><h3>No tasks yet</h3></div> : tasks.map(task => (
        <div key={task.id} className="task-item"><div className={`task-status ${task.status}`} /><div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{task.title}</div>{task.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{task.description}</div>}</div><span className="badge badge-warning">{task.status}</span></div>
      ))}</div>)}
    </div>
  );
}
