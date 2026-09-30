import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'app.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  const SQL = require('sql.js');
  let buffer = null;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  const sqlPromise = SQL();
  throw new Error('Use getDbAsync');
}

let _dbInstance = null;
let _initPromise = null;

async function initDb() {
  if (_dbInstance) return _dbInstance;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs();
    let buffer = null;
    if (fs.existsSync(DB_PATH)) {
      buffer = fs.readFileSync(DB_PATH);
    }
    const db = new SQL.Database(buffer ? new Uint8Array(buffer) : undefined);

    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run(`CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (workspace_id, user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(workspace_id, content_hash)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY, document_id TEXT NOT NULL, workspace_id TEXT NOT NULL, content TEXT NOT NULL, chunk_index INTEGER NOT NULL, embedding TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON chunks(workspace_id)`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, citations TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id)`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS tool_logs (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, tool_name TEXT NOT NULL, args TEXT, result TEXT, success INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tool_logs_workspace ON tool_logs(workspace_id)`);

    _dbInstance = db;
    save();
    return db;
  })();

  return _initPromise;
}

function save() {
  if (!_dbInstance) return;
  const data = _dbInstance.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const db = {
  prepare: (sql) => ({
    run: async (...params) => {
      const d = await initDb();
      d.run(sql, params);
      save();
    },
    get: async (...params) => {
      const d = await initDb();
      const stmt = d.prepare(sql);
      stmt.bind(params);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return result;
    },
    all: async (...params) => {
      const d = await initDb();
      const results = [];
      const stmt = d.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    }
  }),
  transaction: (fn) => async () => {
    const d = await initDb();
    d.run('BEGIN TRANSACTION');
    try {
      await fn();
      d.run('COMMIT');
      save();
    } catch (e) {
      d.run('ROLLBACK');
      throw e;
    }
  }
};

export default db;
export { initDb };
