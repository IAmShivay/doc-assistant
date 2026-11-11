import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';
import { chunkText, contentHash } from '@/lib/utils';
import { embedBatch } from '@/lib/embeddings';

const uploadDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  }
  return buffer.toString('utf-8');
}

export async function POST(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    await checkWorkspaceMember(user.id, workspaceId);

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const allowed = ['.txt', '.md', '.csv', '.json', '.pdf'];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowed.includes(ext)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = await extractText(buffer, file.name);
    if (!content?.trim()) return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });

    const hash = contentHash(content);
    const existing = await db.prepare('SELECT id FROM documents WHERE workspace_id = ? AND content_hash = ?').get(workspaceId, hash);
    if (existing) return NextResponse.json({ id: existing.id, message: 'Document already exists', duplicate: true });

    const docId = uuidv4();
    const filename = uuidv4() + ext;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    const chunks = chunkText(content);
    const embeddings = await embedBatch(chunks);

    await db.prepare('INSERT INTO documents (id, workspace_id, filename, original_name, content_hash) VALUES (?, ?, ?, ?, ?)').run(docId, workspaceId, filename, file.name, hash);
    for (let i = 0; i < chunks.length; i++) {
      await db.prepare('INSERT INTO chunks (id, document_id, workspace_id, content, chunk_index, embedding) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), docId, workspaceId, chunks[i], i, JSON.stringify(embeddings[i]));
    }

    return NextResponse.json({ id: docId, original_name: file.name, chunks: chunks.length, message: 'Document uploaded and indexed' }, { status: 201 });
  } catch (e) { console.error('Upload error:', e); return NextResponse.json({ error: 'Upload failed: ' + e.message }, { status: 500 }); }
}
