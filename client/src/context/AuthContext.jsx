import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { auth as authApi, workspaces as wsApi, safeGetItem, safeSetItem, safeRemoveItem } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceList, setWorkspaceList] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const token = safeGetItem('token');
    if (token) {
      authApi.me()
        .then(data => {
          if (!mounted.current) return;
          setUser(data.user);
          return loadWorkspaces();
        })
        .catch(() => {
          if (!mounted.current) return;
          safeRemoveItem('token');
        })
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => { mounted.current = false; };
  }, []);

  async function loadWorkspaces() {
    try {
      const list = await wsApi.list();
      if (!mounted.current) return;
      setWorkspaceList(list);
      const savedWs = safeGetItem('activeWorkspace');
      const found = list.find(w => w.id === savedWs);
      setActiveWorkspace(found || list[0] || null);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  }

  function switchWorkspace(ws) {
    setActiveWorkspace(ws);
    safeSetItem('activeWorkspace', ws.id);
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    safeSetItem('token', data.token);
    setUser(data.user);
    await loadWorkspaces();
  }

  async function register(email, password) {
    const data = await authApi.register(email, password);
    safeSetItem('token', data.token);
    setUser(data.user);
    await loadWorkspaces();
  }

  function logout() {
    safeRemoveItem('token');
    safeRemoveItem('activeWorkspace');
    setUser(null);
    setWorkspaceList([]);
    setActiveWorkspace(null);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout,
      workspaceList, setWorkspaceList, activeWorkspace, switchWorkspace, loadWorkspaces
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
