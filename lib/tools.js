import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

export const toolDefinitions = [
  { name: 'save_task', description: 'Save a task or to-do item into the current workspace.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'Short title' }, description: { type: 'string', description: 'Optional description' } }, required: ['title'] } },
  { name: 'send_notification', description: 'Send a message to Discord channel.', parameters: { type: 'object', properties: { message: { type: 'string', description: 'Message content' } }, required: ['message'] } },
  { name: 'list_tasks', description: 'List all tasks in the current workspace.', parameters: { type: 'object', properties: {} } }
];

export const groqTools = toolDefinitions.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

function validateArgs(toolName, args) {
  const def = toolDefinitions.find(t => t.name === toolName);
  if (!def) return { valid: false, error: `Unknown tool: ${toolName}` };
  for (const field of (def.parameters.required || [])) {
    if (!args[field]) return { valid: false, error: `Missing required field: ${field}` };
  }
  return { valid: true };
}

async function logToolCall(wsId, userId, name, args, result, success) {
  await db.prepare('INSERT INTO tool_logs (id, workspace_id, user_id, tool_name, args, result, success) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), wsId, userId, name, JSON.stringify(args), JSON.stringify(result), success ? 1 : 0);
}

export async function executeTool(toolName, args, workspaceId, userId) {
  const validation = validateArgs(toolName, args);
  if (!validation.valid) {
    const result = { success: false, error: validation.error };
    await logToolCall(workspaceId, userId, toolName, args, result, false);
    return result;
  }
  let result;
  switch (toolName) {
    case 'save_task': {
      const id = uuidv4();
      await db.prepare('INSERT INTO tasks (id, workspace_id, title, description) VALUES (?, ?, ?, ?)').run(id, workspaceId, args.title, args.description || null);
      result = { success: true, taskId: id, title: args.title, message: `Task "${args.title}" saved.` };
      break;
    }
    case 'send_notification': {
      const url = process.env.DISCORD_WEBHOOK_URL;
      if (!url || url.includes('your_')) {
        result = { success: true, message: 'Notification logged (no webhook configured)', content: args.message };
      } else {
        try {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: args.message }) });
          result = r.ok ? { success: true, message: 'Sent to Discord.' } : { success: false, message: `Discord error: ${r.status}` };
        } catch (e) { result = { success: false, message: e.message }; }
      }
      break;
    }
    case 'list_tasks': {
      const tasks = await db.prepare('SELECT id, title, description, status, created_at FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
      result = { success: true, tasks, count: tasks.length };
      break;
    }
    default: result = { success: false, error: `Unknown tool: ${toolName}` };
  }
  await logToolCall(workspaceId, userId, toolName, args, result, result.success);
  return result;
}
