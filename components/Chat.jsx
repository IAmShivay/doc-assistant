'use client';
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useAuth } from '@/context/AuthContext';
import { Send, RotateCcw, AlertTriangle, Zap, MessageSquare, Search, Clock, FolderOpen, Check, X } from 'lucide-react';

export default function Chat() {
  const { activeWorkspace, apiFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [debugData, setDebugData] = useState({});
  const [obsData, setObsData] = useState({});
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => { if (activeWorkspace) loadHistory(); }, [activeWorkspace?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  async function loadHistory() { try { const h = await apiFetch(`/chat/${activeWorkspace.id}/history`); setMessages(h); setDebugData({}); setObsData({}); } catch {} }

  async function sendMessage(text) {
    if (!text.trim() || sending) return;
    const userMsg = text.trim(); setInput(''); setSending(true);
    setMessages(prev => [...prev, { id: 'u-' + Date.now(), role: 'user', content: userMsg, citations: [] }]);
    try {
      const result = await apiFetch(`/chat/${activeWorkspace.id}/send`, { method: 'POST', body: JSON.stringify({ message: userMsg }) });
      const aMsg = { id: 'a-' + Date.now(), role: 'assistant', content: result.message, citations: result.citations || [], toolCalls: result.toolCalls || [] };
      setMessages(prev => [...prev, aMsg]);
      setDebugData(prev => ({ ...prev, [aMsg.id]: result.retrievedChunks || [] }));
      if (result.observability) setObsData(prev => ({ ...prev, [aMsg.id]: result.observability }));
    } catch (err) {
      setMessages(prev => [...prev, { id: 'e-' + Date.now(), role: 'error', content: err.message, retryText: userMsg }]);
    } finally { setSending(false); inputRef.current?.focus(); }
  }

  function handleRetry(retryText) { setMessages(prev => { const l = prev[prev.length - 1]; return l?.role === 'error' ? prev.slice(0, -2) : prev.slice(0, -1); }); sendMessage(retryText); }
  async function handleClear() { if (!confirm('Clear chat history?')) return; try { await apiFetch(`/chat/${activeWorkspace.id}/history`, { method: 'DELETE' }); setMessages([]); setDebugData({}); setObsData({}); } catch {} }

  if (!activeWorkspace) return (
    <div className="chat-empty-full">
      <FolderOpen size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
      <h3>Select a workspace</h3>
      <p>Choose or create a workspace to start chatting</p>
    </div>
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-icon"><Zap size={18} /></div>
          <div>
            <div className="chat-header-title">Document Assistant</div>
            <div className="chat-header-sub">Ask anything about your documents</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleClear}>Clear</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <MessageSquare size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
            <h2>How can I help you?</h2>
            <p>Upload documents to your workspace, then ask me questions about them.</p>
            <div className="chat-suggestions">
              <button onClick={() => sendMessage('What documents are available?')}>What documents are available?</button>
              <button onClick={() => sendMessage('Summarize the key points')}>Summarize the key points</button>
              <button onClick={() => sendMessage('List my tasks')}>List my tasks</button>
            </div>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === 'error') return (
            <div key={msg.id} className="chat-row assistant">
              <div className="chat-avatar bot-avatar"><AlertTriangle size={14} /></div>
              <div className="chat-bubble-wrap">
                <div className="chat-bubble error-bubble">
                  <div className="error-icon-text"><AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} /><span>Something went wrong: {msg.content}</span></div>
                  <button className="retry-btn" onClick={() => handleRetry(msg.retryText)}><RotateCcw size={14} /> Regenerate response</button>
                </div>
              </div>
            </div>
          );

          return (
            <div key={msg.id} className={`chat-row ${msg.role}`}>
              {msg.role === 'assistant' ? <div className="chat-avatar bot-avatar">A</div> : <div className="chat-avatar user-avatar">U</div>}
              <div className="chat-bubble-wrap">
                <div className={`chat-bubble ${msg.role}-bubble`}>
                  {msg.role === 'assistant' ? <div className="markdown-body"><ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown></div> : <div>{msg.content}</div>}
                  {msg.toolCalls?.length > 0 && (
                    <div className="tool-calls-box">
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} className="tool-call-item">
                          <span className={`tool-call-status ${tc.result?.success ? 'success' : 'fail'}`}>{tc.result?.success ? <Check size={11} /> : <X size={11} />}</span>
                          <span className="tool-call-name">{tc.name}</span>
                          <span className="tool-call-args">({Object.values(tc.args || {}).join(', ')})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.citations?.length > 0 && (
                    <div className="citations-box">
                      <span className="citations-label">Sources</span>
                      {msg.citations.map((c, i) => <span key={i} className="citation-chip">{c.source} <span className="citation-score">{(c.score * 100).toFixed(0)}%</span></span>)}
                    </div>
                  )}
                </div>
                {debugData[msg.id]?.length > 0 && (
                  <details className="debug-details">
                    <summary><Search size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Retrieved Chunks ({debugData[msg.id].length})</summary>
                    <div className="debug-chunks-list">
                      {debugData[msg.id].map((c, i) => <div key={i} className="debug-chunk-item"><div className="debug-chunk-header"><span className="debug-chunk-source">{c.source}</span><span className="debug-chunk-score">{(c.score * 100).toFixed(1)}%</span></div><div className="debug-chunk-text">{c.content}</div></div>)}
                    </div>
                  </details>
                )}
                {obsData[msg.id] && (
                  <details className="debug-details">
                    <summary><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Performance</summary>
                    <div className="obs-grid">
                      <div className="obs-item"><span className="obs-label">Embedding</span><span className="obs-value">{obsData[msg.id].embeddingLatencyMs}ms</span></div>
                      <div className="obs-item"><span className="obs-label">Retrieval</span><span className="obs-value">{obsData[msg.id].retrievalLatencyMs}ms</span></div>
                      <div className="obs-item"><span className="obs-label">Total</span><span className="obs-value">{obsData[msg.id].totalLatencyMs}ms</span></div>
                      <div className="obs-item"><span className="obs-label">Chunks</span><span className="obs-value">{obsData[msg.id].chunksRetrieved}</span></div>
                      {obsData[msg.id].tokenUsage?.totalTokens && <div className="obs-item"><span className="obs-label">Tokens</span><span className="obs-value">{obsData[msg.id].tokenUsage.totalTokens}</span></div>}
                    </div>
                  </details>
                )}
                <div className="chat-timestamp">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="chat-row assistant">
            <div className="chat-avatar bot-avatar">A</div>
            <div className="chat-bubble-wrap"><div className="chat-bubble assistant-bubble"><div className="typing-indicator"><span></span><span></span><span></span></div></div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-container">
        <form className="chat-input-form" onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
          <div className="chat-input-wrapper">
            <input ref={inputRef} className="chat-input" placeholder="Message Document Assistant..." value={input} onChange={e => setInput(e.target.value)} disabled={sending} autoFocus />
            <button type="submit" className={`chat-send-btn ${input.trim() && !sending ? 'active' : ''}`} disabled={sending || !input.trim()}>
              <Send size={16} />
            </button>
          </div>
          <div className="chat-input-hint">Press Enter to send</div>
        </form>
      </div>
    </div>
  );
}
