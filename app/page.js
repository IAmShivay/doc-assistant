'use client';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';

function AppContent() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" style={{ width: 32, height: 32 }} /></div>;
  return user ? <Dashboard /> : <Login />;
}

export default function Home() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
