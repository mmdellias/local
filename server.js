const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { initDb, all, get, run } = require('./db');
const path = require('path');
const fs = require('fs');

const Layer = require('express/lib/router/layer');
const originalHandle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) { next(err); }
};

async function start() {
  await initDb();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(__dirname)));

  async function createActivity(text, type) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const timestamp = new Date().toISOString();
    await run('INSERT INTO activity (id, text, type, timestamp) VALUES ($1, $2, $3, $4)', [id, text, type, timestamp]);
    return { id, text, type, timestamp };
  }

  app.get('/api/members', async (req, res) => {
    res.json(await all('SELECT * FROM members'));
  });

  app.post('/api/members', async (req, res) => {
    const { name, email, role, status, photo } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await run('INSERT INTO members (id, name, email, role, status, photo) VALUES ($1, $2, $3, $4, $5, $6)', [id, name, email || '', role || '', status || 'online', photo || '']);
    const member = await get('SELECT * FROM members WHERE id = $1', [id]);
    const activity = await createActivity(`Membro "${name}" adicionado à equipe`, 'member');
    io.emit('member:created', member);
    io.emit('activity:new', activity);
    res.json(member);
  });

  app.put('/api/members/:id', async (req, res) => {
    const { name, email, role, status, photo } = req.body;
    const existing = await get('SELECT * FROM members WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Member not found' });
    await run('UPDATE members SET name = $1, email = $2, role = $3, status = $4, photo = $5 WHERE id = $6', [name, email || '', role || '', status || 'offline', photo !== undefined ? photo : existing.photo, req.params.id]);
    const member = await get('SELECT * FROM members WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Membro "${name}" atualizado`, 'member');
    io.emit('member:updated', member);
    io.emit('activity:new', activity);
    res.json(member);
  });

  app.delete('/api/members/:id', async (req, res) => {
    const existing = await get('SELECT * FROM members WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Member not found' });
    await run('DELETE FROM members WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Membro "${existing.name}" removido`, 'member');
    io.emit('member:deleted', { id: req.params.id });
    io.emit('activity:new', activity);
    res.json({ success: true });
  });

  app.get('/api/tasks', async (req, res) => {
    res.json(await all('SELECT * FROM tasks'));
  });

  app.post('/api/tasks', async (req, res) => {
    const { title, description, category, dueDate, assigneeId, col } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    await run('INSERT INTO tasks (id, title, description, category, dueDate, assigneeId, col, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, title, description || '', category || '', dueDate || '', assigneeId || '', col || 'todo', createdAt]);
    const task = await get('SELECT * FROM tasks WHERE id = $1', [id]);
    const activity = await createActivity(`Nova tarefa "${title}" adicionada`, 'task');
    io.emit('task:created', task);
    io.emit('activity:new', activity);
    res.json(task);
  });

  app.put('/api/tasks/:id', async (req, res) => {
    const { title, description, category, dueDate, assigneeId, col } = req.body;
    const existing = await get('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await run('UPDATE tasks SET title = $1, description = $2, category = $3, dueDate = $4, assigneeId = $5, col = $6 WHERE id = $7', [title, description || '', category || '', dueDate || '', assigneeId || '', col || existing.col, req.params.id]);
    const task = await get('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Tarefa "${title}" atualizada`, 'task');
    io.emit('task:updated', task);
    io.emit('activity:new', activity);
    res.json(task);
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    const existing = await get('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await run('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Tarefa "${existing.title}" excluída`, 'task');
    io.emit('task:deleted', { id: req.params.id });
    io.emit('activity:new', activity);
    res.json({ success: true });
  });

  app.patch('/api/tasks/:id/move', async (req, res) => {
    const { col } = req.body;
    const existing = await get('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await run('UPDATE tasks SET col = $1 WHERE id = $2', [col, req.params.id]);
    const task = await get('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    const colLabels = { todo: 'Para Fazer', in_progress: 'Em Progresso', done: 'Concluído' };
    const activity = await createActivity(`Tarefa "${existing.title}" movida para "${colLabels[col] || col}"`, 'task');
    io.emit('task:moved', { id: req.params.id, fromCol: existing.col, toCol: col, task });
    io.emit('activity:new', activity);
    res.json(task);
  });

  app.get('/api/folders', async (req, res) => {
    res.json(await all('SELECT * FROM folders'));
  });

  app.post('/api/folders', async (req, res) => {
    const { name, color } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await run('INSERT INTO folders (id, name, color) VALUES ($1, $2, $3)', [id, name, color || '#10b981']);
    const folder = await get('SELECT * FROM folders WHERE id = $1', [id]);
    const activity = await createActivity(`Pasta "${name}" criada`, 'folder');
    io.emit('folder:created', folder);
    io.emit('activity:new', activity);
    res.json(folder);
  });

  app.delete('/api/folders/:id', async (req, res) => {
    const existing = await get('SELECT * FROM folders WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Folder not found' });
    await run('DELETE FROM folders WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Pasta "${existing.name}" excluída`, 'folder');
    io.emit('folder:deleted', { id: req.params.id });
    io.emit('activity:new', activity);
    res.json({ success: true });
  });

  app.get('/api/links', async (req, res) => {
    res.json(await all('SELECT * FROM links ORDER BY createdAt DESC'));
  });

  app.post('/api/links', async (req, res) => {
    const { title, url, description, category } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Título e URL são obrigatórios' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    await run('INSERT INTO links (id, title, url, description, category, createdAt) VALUES ($1, $2, $3, $4, $5, $6)', [id, title, url, description || '', category || '', createdAt]);
    const link = await get('SELECT * FROM links WHERE id = $1', [id]);
    const activity = await createActivity(`Link "${title}" adicionado`, 'link');
    io.emit('link:created', link);
    io.emit('activity:new', activity);
    res.json(link);
  });

  app.put('/api/links/:id', async (req, res) => {
    const { title, url, description, category } = req.body;
    const existing = await get('SELECT * FROM links WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Link not found' });
    await run('UPDATE links SET title = $1, url = $2, description = $3, category = $4 WHERE id = $5', [title, url, description || '', category || '', req.params.id]);
    const link = await get('SELECT * FROM links WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Link "${title}" atualizado`, 'link');
    io.emit('link:updated', link);
    io.emit('activity:new', activity);
    res.json(link);
  });

  app.delete('/api/links/:id', async (req, res) => {
    const existing = await get('SELECT * FROM links WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Link not found' });
    await run('DELETE FROM links WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Link "${existing.title}" removido`, 'link');
    io.emit('link:deleted', { id: req.params.id });
    io.emit('activity:new', activity);
    res.json({ success: true });
  });

  app.get('/api/files', async (req, res) => {
    res.json(await all('SELECT * FROM files'));
  });

  app.post('/api/files', async (req, res) => {
    const { name, type, size, sizeLabel, data, folderId } = req.body;
    if (!data) return res.status(400).json({ error: 'Dados do arquivo são obrigatórios' });
    if (size > 2 * 1024 * 1024) return res.status(400).json({ error: 'Arquivo deve ter no máximo 2MB' });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const date = new Date().toISOString();

    const matches = data.match(/^data:([^;]+);base64,(.+)$/);
    let diskPath = '';
    if (matches) {
      const ext = path.extname(name) || '';
      const safeName = id + ext;
      const buffer = Buffer.from(matches[2], 'base64');
      fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
      diskPath = safeName;
    }

    await run('INSERT INTO files (id, name, type, size, sizeLabel, data, folderId, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, name, type || '', size || 0, sizeLabel || '', diskPath, folderId || '', date]);
    const file = await get('SELECT * FROM files WHERE id = $1', [id]);
    const activity = await createActivity(`Arquivo "${name}" adicionado`, 'file');
    io.emit('file:created', file);
    io.emit('activity:new', activity);
    res.json(file);
  });

  app.get('/api/files/:id/download', async (req, res) => {
    const file = await get('SELECT * FROM files WHERE id = $1', [req.params.id]);
    if (!file || !file.data) return res.status(404).json({ error: 'Arquivo não encontrado' });
    const filePath = path.join(uploadsDir, file.data);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
    res.download(filePath, file.name);
  });

  app.delete('/api/files/:id', async (req, res) => {
    const existing = await get('SELECT * FROM files WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'File not found' });
    if (existing.data) {
      const filePath = path.join(uploadsDir, existing.data);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await run('DELETE FROM files WHERE id = $1', [req.params.id]);
    const activity = await createActivity(`Arquivo "${existing.name}" excluído`, 'file');
    io.emit('file:deleted', { id: req.params.id });
    io.emit('activity:new', activity);
    res.json({ success: true });
  });

  app.get('/api/activity', async (req, res) => {
    res.json(await all('SELECT * FROM activity ORDER BY timestamp DESC LIMIT 50'));
  });

  app.get('/api/settings', async (req, res) => {
    const rows = await all('SELECT * FROM settings');
    const settings = { name: 'Meu Workspace' };
    rows.forEach(s => settings[s.key] = s.value);
    res.json(settings);
  });

  app.put('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    await run('DELETE FROM settings WHERE key = $1', [key]);
    await run('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, value]);
    res.json({ success: true });
  });

  app.use((err, req, res, next) => {
    console.error('Erro no servidor:', err);
    res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
