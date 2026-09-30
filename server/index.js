import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRouter from './auth.js';
import workspacesRouter from './workspaces.js';
import documentsRouter from './documents.js';
import chatRouter from './chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

const distPath = path.join(__dirname, '..', 'client', 'dist');
const indexPath = path.join(distPath, 'index.html');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send('App is starting up. Client build not found. Please redeploy.');
    }
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (!process.env.GROQ_API_KEY) {
  console.error('WARNING: GROQ_API_KEY not set. Chat will fail.');
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set. Using insecure default. Set it in production!');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
