import db from './db.js';

const VOCAB_SIZE = 2048;

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
}

function hashToken(token) {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  return Math.abs(h) % VOCAB_SIZE;
}

function termFrequency(tokens) {
  const tf = new Float64Array(VOCAB_SIZE);
  for (const token of tokens) tf[hashToken(token)] += 1;
  const max = Math.max(...tf, 1);
  for (let i = 0; i < VOCAB_SIZE; i++) tf[i] /= max;
  return tf;
}

function buildIdf() {
  const allChunks = db.prepare('SELECT content FROM chunks').all();
  const docCount = allChunks.length || 1;
  const df = new Float64Array(VOCAB_SIZE);
  for (const chunk of allChunks) {
    const seen = new Set();
    for (const token of tokenize(chunk.content)) {
      const idx = hashToken(token);
      if (!seen.has(idx)) { df[idx]++; seen.add(idx); }
    }
  }
  const idf = new Float64Array(VOCAB_SIZE);
  for (let i = 0; i < VOCAB_SIZE; i++) idf[i] = Math.log((docCount + 1) / (df[i] + 1)) + 1;
  return idf;
}

let cachedIdf = null, idfChunkCount = 0;

function getIdf() {
  const currentCount = db.prepare('SELECT COUNT(*) as c FROM chunks').get().c;
  if (!cachedIdf || currentCount !== idfChunkCount) { cachedIdf = buildIdf(); idfChunkCount = currentCount; }
  return cachedIdf;
}

function tfidfVector(text) {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  const idf = getIdf();
  const vec = new Array(VOCAB_SIZE);
  for (let i = 0; i < VOCAB_SIZE; i++) vec[i] = tf[i] * idf[i];
  let mag = 0;
  for (let i = 0; i < VOCAB_SIZE; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < VOCAB_SIZE; i++) vec[i] /= mag;
  return vec;
}

export function embedText(text) { return tfidfVector(text); }
export function embedBatch(texts) { return texts.map(t => tfidfVector(t)); }
