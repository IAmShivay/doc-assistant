import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { documents as docApi } from '../api';

export default function DocumentList() {
  const { activeWorkspace } = useAuth();
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (activeWorkspace) loadDocs();
  }, [activeWorkspace?.id]);

  async function loadDocs() {
    try {
      const list = await docApi.list(activeWorkspace.id);
      setDocs(list);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const result = await docApi.upload(activeWorkspace.id, file);
      setUploadMsg(result.duplicate ? 'Document already exists' : `Uploaded: ${result.chunks} chunks indexed`);
      await loadDocs();
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(docId) {
    if (!confirm('Delete this document?')) return;
    try {
      await docApi.remove(activeWorkspace.id, docId);
      await loadDocs();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!activeWorkspace) return <div className="empty-state"><h3>Select a workspace</h3></div>;

  return (
    <div>
      <div className="upload-area">
        <input type="file" ref={fileRef} onChange={handleUpload} accept=".txt,.md,.csv,.json,.pdf" id="file-upload" />
        <label htmlFor="file-upload">
          {uploading ? <><span className="loading-spinner" /> Processing...</> : 'Click to upload a document'}
        </label>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          Supported: .txt, .md, .csv, .json, .pdf (max 10MB)
        </p>
        {uploadMsg && <p style={{ fontSize: 13, marginTop: 8, color: uploadMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>{uploadMsg}</p>}
      </div>

      <div className="doc-list">
        {docs.length === 0 ? (
          <div className="empty-state">
            <h3>No documents yet</h3>
            <p>Upload documents to start asking questions</p>
          </div>
        ) : docs.map(doc => (
          <div key={doc.id} className="doc-item">
            <div>
              <div className="doc-item-name">{doc.original_name}</div>
              <div className="doc-item-date">{new Date(doc.created_at).toLocaleDateString()}</div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
