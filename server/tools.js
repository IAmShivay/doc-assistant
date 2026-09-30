import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

export const toolDefinitions = [
  {
    name: 'save_task',
    description: 'Save a task or to-do item into the current workspace. Use this when the user asks to create, save, or remember a task.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title of the task' },
        description: { type: 'string', description: 'Optional longer description' }
      },
      required: ['title']
    }
  },
  {
    name: 'send_notification',
    description: 'Send a summary or notification message to a Discord channel. Use this when the user asks to send, share, or notify about something.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message content to send' }
      },
      required: ['message']
    }
  },
  {
    name: 'list_tasks',
    description: 'List all tasks in the current workspace. Use this when the user asks to see their tasks or to-do items.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

export const geminiToolDeclarations = toolDefinitions.map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.parameters
}));

function validateArgs(toolName, args) {
  const def = toolDefinitions.find(t => t.name === toolName);
  if (!def) return { valid: false, error: `Unknown tool: ${toolName}` };

  const required = def.parameters.required || [];
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === '') {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  const allowed = Object.keys(def.parameters.properties || {});
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      return { valid: false, error: `Unknown argument: ${key}` };
    }
  }

  for (const [key, val] of Object.entries(args)) {
    const schema = def.parameters.properties[key];
    if (schema && schema.type === 'string' && typeof val !== 'string') {
      return { valid: false, error: `Argument ${key} must be a string` };
    }
  }

  return { valid: true };
}

async function executeSaveTask(args, workspaceId) {
  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id, workspace_id, title, description) VALUES (?, ?, ?, ?)')
    .run(id, workspaceId, args.title, args.description || null);
  return { success: true, taskId: id, title: args.title, message: `Task "${args.title}" saved successfully.` };
}

async function executeSendNotification(args) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: true, message: 'Notification logged (no Discord webhook configured)', content: args.message };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: args.message })
    });
    if (!res.ok) throw new Error(`Discord returned ${res.status}`);
    return { success: true, message: 'Notification sent to Discord successfully.' };
  } catch (err) {
    return { success: false, message: `Failed to send notification: ${err.message}` };
  }
}

async function executeListTasks(args, workspaceId) {
  const tasks = db.prepare('SELECT id, title, description, status, created_at FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
  return { success: true, tasks, count: tasks.length };
}

export async function executeTool(toolName, args, workspaceId, userId) {
  const validation = validateArgs(toolName, args);
  if (!validation.valid) {
    const result = { success: false, error: validation.error };
    logToolCall(workspaceId, userId, toolName, args, result, false);
    return result;
  }

  let result;
  switch (toolName) {
    case 'save_task':
      result = await executeSaveTask(args, workspaceId);
      break;
    case 'send_notification':
      result = await executeSendNotification(args);
      break;
    case 'list_tasks':
      result = await executeListTasks(args, workspaceId);
      break;
    default:
      result = { success: false, error: `Unknown tool: ${toolName}` };
  }

  logToolCall(workspaceId, userId, toolName, args, result, result.success);
  return result;
}

function logToolCall(workspaceId, userId, toolName, args, result, success) {
  db.prepare('INSERT INTO tool_logs (id, workspace_id, user_id, tool_name, args, result, success) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), workspaceId, userId, toolName, JSON.stringify(args), JSON.stringify(result), success ? 1 : 0);
}
