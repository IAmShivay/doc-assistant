'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function DocumentList() {
  const { activeWorkspace, apiFetch } = useAuth();
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => { if (activeWorkspace) loadDocs(); }, [activeWorkspace?.id]);

  async function loadDocs() { try { setDocs(await apiFetch(`/documents/${activeWorkspace.id}`)); } catch {} }

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadMsg('Error: File too large (max 10MB)'); return; }
    setUploading(true); setUploadMsg('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/documents/${activeWorkspace.id}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadMsg(data.duplicate ? 'Document already exists' : `Uploaded: ${data.chunks} chunks indexed`);
      await loadDocs();
    } catch (err) { setUploadMsg(`Error: ${err.message}`); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleDelete(docId) {
    if (!confirm('Delete this document?')) return;
    try { await apiFetch(`/documents/${activeWorkspace.id}/${docId}`, { method: 'DELETE' }); await loadDocs(); } catch (err) { alert(err.message); }
  }

  if (!activeWorkspace) return <div className="empty-state"><h3>Select a workspace</h3></div>;
  return (
    <div>
      <div className="upload-area">
        <input type="file" ref={fileRef} onChange={handleUpload} accept=".txt,.md,.csv,.json,.pdf" id="file-upload" />
        <label htmlFor="file-upload">{uploading ? <><span className="loading-spinner" /> Processing...</> : 'Click to upload a document'}</label>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Supported: .txt, .md, .csv, .json, .pdf (max 10MB)</p>
        {uploadMsg && <p style={{ fontSize: 13, marginTop: 8, color: uploadMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>{uploadMsg}</p>}
      </div>
      <div className="doc-list">
        {docs.length === 0 ? <div className="empty-state"><h3>No documents yet</h3><p>Upload documents to start asking questions</p></div> : docs.map(doc => (
          <div key={doc.id} className="doc-item"><div><div className="doc-item-name">{doc.original_name}</div><div className="doc-item-date">{new Date(doc.created_at).toLocaleDateString()}</div></div><button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>Delete</button></div>
        ))}
      </div>
    </div>
  );
}
