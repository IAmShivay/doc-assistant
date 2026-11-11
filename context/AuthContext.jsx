'use client';
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const BASE = '/api';
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function safeRemove(k) { try { localStorage.removeItem(k); } catch {} }

function getHeaders() {
  const token = safeGet('token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders(), ...opts });
  if (res.status === 401 && !path.includes('/auth/')) { safeRemove('token'); safeRemove('activeWorkspace'); window.location.reload(); throw new Error('Session expired'); }
  let data; try { data = await res.json(); } catch { throw new Error('Invalid response'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceList, setWorkspaceList] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const token = safeGet('token');
    if (token) {
      apiFetch('/auth/me').then(d => { if (mounted.current) { setUser(d.user); return loadWorkspaces(); } }).catch(() => { if (mounted.current) safeRemove('token'); }).finally(() => { if (mounted.current) setLoading(false); });
    } else setLoading(false);
    return () => { mounted.current = false; };
  }, []);

  async function loadWorkspaces() {
    try {
      const list = await apiFetch('/workspaces');
      if (!mounted.current) return;
      setWorkspaceList(list);
      const saved = safeGet('activeWorkspace');
      setActiveWorkspace(list.find(w => w.id === saved) || list[0] || null);
    } catch {}
  }

  function switchWorkspace(ws) { setActiveWorkspace(ws); safeSet('activeWorkspace', ws.id); }

  async function login(email, password) {
    const d = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    safeSet('token', d.token); setUser(d.user); await loadWorkspaces();
  }

  async function register(email, password) {
    const d = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    safeSet('token', d.token); setUser(d.user); await loadWorkspaces();
  }

  function logout() { safeRemove('token'); safeRemove('activeWorkspace'); setUser(null); setWorkspaceList([]); setActiveWorkspace(null); }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, workspaceList, setWorkspaceList, activeWorkspace, switchWorkspace, loadWorkspaces, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
