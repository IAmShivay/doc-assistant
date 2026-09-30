import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';
import { authMiddleware } from './auth.js';
import { requireWorkspaceMember } from './workspaces.js';
import { chunkText, contentHash } from './utils.js';
import { embedBatch } from './embeddings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.md', '.csv', '.json', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

const router = Router();
router.use(authMiddleware);

router.get('/:workspaceId', requireWorkspaceMember, (req, res) => {
  const docs = db.prepare('SELECT id, filename, original_name, created_at FROM documents WHERE workspace_id = ? ORDER BY created_at DESC')
    .all(req.workspaceId);
  res.json(docs);
});

router.post('/:workspaceId/upload', requireWorkspaceMember, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid file uploaded. Supported: .txt, .md, .csv, .json, .pdf' });

  try {
    const filePath = req.file.path;
    const content = await extractText(filePath, req.file.originalname);

    if (!content || !content.trim()) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Could not extract text from file. File may be empty or unreadable.' });
    }

    const hash = contentHash(content);

    const existing = db.prepare('SELECT id FROM documents WHERE workspace_id = ? AND content_hash = ?')
      .get(req.workspaceId, hash);

    if (existing) {
      fs.unlinkSync(filePath);
      return res.json({ id: existing.id, message: 'Document already exists in this workspace', duplicate: true });
    }

    const docId = uuidv4();
    const chunks = chunkText(content);

    let embeddings;
    try {
      const batchSize = 20;
      embeddings = [];
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchEmb = await embedBatch(batch);
        embeddings.push(...batchEmb);
      }
    } catch (embErr) {
      fs.unlinkSync(filePath);
      return res.status(500).json({ error: `Embedding failed: ${embErr.message}` });
    }

    const insertDoc = db.prepare('INSERT INTO documents (id, workspace_id, filename, original_name, content_hash) VALUES (?, ?, ?, ?, ?)');
    const insertChunk = db.prepare('INSERT INTO chunks (id, document_id, workspace_id, content, chunk_index, embedding) VALUES (?, ?, ?, ?, ?, ?)');

    const transaction = db.transaction(() => {
      insertDoc.run(docId, req.workspaceId, req.file.filename, req.file.originalname, hash);
      for (let i = 0; i < chunks.length; i++) {
        insertChunk.run(uuidv4(), docId, req.workspaceId, chunks[i], i, JSON.stringify(embeddings[i]));
      }
    });

    transaction();

    res.status(201).json({
      id: docId,
      original_name: req.file.originalname,
      chunks: chunks.length,
      message: 'Document uploaded and indexed'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.delete('/:workspaceId/:docId', requireWorkspaceMember, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND workspace_id = ?').get(req.params.docId, req.workspaceId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare('DELETE FROM chunks WHERE document_id = ?').run(req.params.docId);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.docId);

  const filePath = path.join(uploadDir, doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.json({ ok: true });
});

export default router;
