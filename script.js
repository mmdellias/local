const STORAGE_KEYS = {
  members: 'workspace_members',
  tasks: 'workspace_tasks',
  files: 'workspace_files',
  folders: 'workspace_folders',
  activity: 'workspace_activity',
  settings: 'workspace_settings'
};

function getData(key) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[key]);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setData(key, data) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
}

function getDefaults(key) {
  const defaults = {
    members: [],
    tasks: { todo: [], in_progress: [], done: [] },
    files: [],
    folders: [],
    activity: [],
    settings: { name: 'Meu Workspace' }
  };
  return defaults[key];
}

function load(key) {
  return getData(key) ?? getDefaults(key);
}

function save(key, data) {
  setData(key, data);
}

let state = {};
function initState() {
  state.members = load('members');
  state.tasks = load('tasks');
  state.files = load('files');
  state.folders = load('folders');
  state.activity = load('activity');
  state.settings = load('settings');
}

function persist(key) {
  save(key, state[key]);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

function formatDate(iso) {
  const d = new Date(iso);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Há ${days} dia${days > 1 ? 's' : ''}`;
  return formatDate(iso);
}

function addActivity(text, type) {
  const entry = {
    id: uid(),
    text,
    type: type || 'info',
    timestamp: now()
  };
  state.activity.unshift(entry);
  if (state.activity.length > 50) state.activity.length = 50;
  persist('activity');
}

// Navigation
function navigateTo(page) {
  window.location.hash = page;
}

function handleRoute() {
  const page = location.hash.replace('#', '') || 'tasks';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  switch (page) {
    case 'tasks': renderTasks(); break;
    case 'team': renderTeam(); break;
    case 'files': renderFiles(); break;
  }
}

function getActivityIcon(type) {
  const icons = { comment: 'comment', upload: 'upload_file', complete: 'check_circle', urgent: 'priority_high', task: 'assignment', member: 'person', folder: 'folder', file: 'description' };
  return icons[type] || 'info';
}

function getActivityColor(type) {
  const colors = { comment: 'bg-secondary-container text-on-secondary-container', upload: 'bg-secondary-container text-on-secondary-container', complete: 'bg-secondary-container text-on-secondary-container', urgent: 'bg-error-container text-on-error-container', task: 'bg-primary-container text-on-primary-container', member: 'bg-secondary-container text-on-secondary-container', folder: 'bg-surface-container-high text-on-surface-variant', file: 'bg-surface-container-high text-on-surface-variant' };
  return colors[type] || 'bg-surface-container-high text-on-surface-variant';
}

// ==================== TASKS (KANBAN) ====================
function renderTasks() {
  ['todo', 'in_progress', 'done'].forEach(col => {
    const container = document.getElementById(`kanban-${col}`);
    const count = document.getElementById(`count-${col}`);
    const items = state.tasks[col] || [];
    count.textContent = items.length;
    container.innerHTML = '';

    items.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${col === 'done' ? 'done' : ''}`;
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.dataset.column = col;

      const category = task.category || 'Geral';
      const [catBg, catText] = getCategoryColor(task.category);

      card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <span class="badge-tag" style="background:${catBg};color:${catText}">${escapeHtml(category)}</span>
          <div class="flex gap-xs card-actions" style="opacity:0;transition:opacity 0.15s ease">
            <button class="btn-icon" onclick="event.stopPropagation();editTask('${task.id}','${col}')" title="Editar">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button class="btn-icon danger" onclick="event.stopPropagation();deleteTask('${task.id}','${col}')" title="Excluir">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
          ${col === 'done' ? `<span class="material-symbols-outlined text-secondary text-[18px]" style="font-variation-settings:'FILL' 1">check_circle</span>` : ''}
        </div>
        <h3 style="font-size:16px;line-height:1.3;margin-bottom:8px;font-weight:600;font-family:var(--font-family)">${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="text-on-surface-variant" style="font-size:13px;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:400;line-height:1.4;font-family:var(--font-family)">${escapeHtml(task.description)}</p>` : ''}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-xs text-outline" style="font-size:11px;font-weight:600;font-family:var(--font-family)">
            <span class="material-symbols-outlined" style="font-size:14px">schedule</span>
            ${task.dueDate ? formatDate(task.dueDate) : 'Sem data'}
          </div>
          ${task.assigneeId ? renderAssignee(task.assigneeId) : ''}
        </div>
      `;

      card.addEventListener('dragstart', () => {
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      container.appendChild(card);
    });
  });

  setupDragDrop();
}

function getCategoryColor(cat) {
  const map = {
    'Design': ['#dbeafe', '#1e40af'],
    'Pesquisa': ['#f3e8ff', '#7c3aed'],
    'Desenvolvimento': ['#d1fae5', '#065f46'],
    'Marketing': ['#ffedd5', '#9a3412'],
    'Sistemas': ['#e2e8f0', '#475569']
  };
  return map[cat] || ['#e2e8f0', '#475569'];
}

function renderAssignee(memberId) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return '';
  if (member.photo) {
    return `<div class="avatar avatar-sm" style="overflow:hidden;border:2px solid var(--surface-container-lowest);box-shadow:0 0 0 1px var(--outline-variant)" title="${escapeHtml(member.name)}"><img src="${escapeHtml(member.photo)}" style="width:100%;height:100%;object-fit:cover"></div>`;
  }
  return `<div class="avatar avatar-sm" style="background:${member.status === 'online' ? 'var(--secondary)' : 'var(--outline)'};border:2px solid var(--surface-container-lowest);box-shadow:0 0 0 1px var(--outline-variant)" title="${escapeHtml(member.name)}">${getInitials(member.name)}</div>`;
}

function moveTask(taskId, fromCol) {
  const task = state.tasks[fromCol].find(t => t.id === taskId);
  if (!task) return;
  const cols = ['todo', 'in_progress', 'done'];
  const nextIdx = (cols.indexOf(fromCol) + 1) % cols.length;
  const toCol = cols[nextIdx];
  state.tasks[fromCol] = state.tasks[fromCol].filter(t => t.id !== taskId);
  state.tasks[toCol].push(task);
  persist('tasks');
  addActivity(`Tarefa "${task.title}" movida para "${getColLabel(toCol)}"`, 'task');
  renderTasks();
}

function getColLabel(col) {
  const labels = { todo: 'Para Fazer', in_progress: 'Em Progresso', done: 'Concluído' };
  return labels[col] || col;
}

function deleteTask(taskId, col) {
  if (!confirm('Excluir esta tarefa?')) return;
  const task = state.tasks[col].find(t => t.id === taskId);
  state.tasks[col] = state.tasks[col].filter(t => t.id !== taskId);
  persist('tasks');
  addActivity(`Tarefa "${task ? task.title : ''}" excluída`, 'task');
  renderTasks();
}

function setupDragDrop() {
  const containers = document.querySelectorAll('.kanban-cards');
  containers.forEach(container => {
    container.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (!dragging) return;
      const after = getDragAfterElement(container, e.clientY);
      if (after) container.insertBefore(dragging, after);
      else container.appendChild(dragging);
    });

    container.addEventListener('drop', e => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (!dragging) return;
      const taskId = dragging.dataset.taskId;
      const fromCol = dragging.dataset.column;
      const toCol = container.closest('.kanban-column').dataset.column;
      if (fromCol !== toCol) {
        const task = state.tasks[fromCol].find(t => t.id === taskId);
        if (task) {
          state.tasks[fromCol] = state.tasks[fromCol].filter(t => t.id !== taskId);
          state.tasks[toCol].push(task);
          persist('tasks');
          addActivity(`Tarefa "${task.title}" movida para "${getColLabel(toCol)}"`, 'task');
          renderTasks();
        }
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.task-card:not(.dragging)')];
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ==================== TASK MODAL ====================
function openTaskModal(column, editTaskData) {
  const title = editTaskData ? 'Editar Tarefa' : 'Nova Tarefa';
  const task = editTaskData || { title: '', description: '', category: '', dueDate: '', assigneeId: '', column };

  const container = document.getElementById('modal-container');
  const memberOptions = state.members.map(m =>
    `<option value="${m.id}" ${task.assigneeId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
  ).join('');

  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="font-headline-md text-headline-md">${title}</h3>
        <button class="close-btn" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Título</label>
          <input class="form-input" id="task-title" value="${escapeHtml(task.title)}" placeholder="Digite o título da tarefa">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-input" id="task-desc" placeholder="Descrição (opcional)">${escapeHtml(task.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" id="task-category">
            <option value="">Sem categoria</option>
            <option value="Design" ${task.category === 'Design' ? 'selected' : ''}>Design</option>
            <option value="Desenvolvimento" ${task.category === 'Desenvolvimento' ? 'selected' : ''}>Desenvolvimento</option>
            <option value="Pesquisa" ${task.category === 'Pesquisa' ? 'selected' : ''}>Pesquisa</option>
            <option value="Marketing" ${task.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
            <option value="Sistemas" ${task.category === 'Sistemas' ? 'selected' : ''}>Sistemas</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data de Vencimento</label>
          <input class="form-input" id="task-date" type="date" value="${task.dueDate || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Responsável</label>
          <select class="form-select" id="task-assignee">
            <option value="">Sem responsável</option>
            ${memberOptions}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="${editTaskData ? `saveTaskEdit('${task.id}', '${column}')` : `saveTask('${column}')`}">${editTaskData ? 'Salvar' : 'Criar'}</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveTask(column) {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { alert('O título é obrigatório.'); return; }

  const task = {
    id: uid(),
    title,
    description: document.getElementById('task-desc').value.trim(),
    category: document.getElementById('task-category').value,
    dueDate: document.getElementById('task-date').value,
    assigneeId: document.getElementById('task-assignee').value,
    createdAt: now()
  };

  state.tasks[column].push(task);
  persist('tasks');
  addActivity(`Nova tarefa "${title}" adicionada`, 'task');
  closeModal();
  renderTasks();
}

function saveTaskEdit(taskId, col) {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { alert('O título é obrigatório.'); return; }

  const task = state.tasks[col].find(t => t.id === taskId);
  if (task) {
    task.title = title;
    task.description = document.getElementById('task-desc').value.trim();
    task.category = document.getElementById('task-category').value;
    task.dueDate = document.getElementById('task-date').value;
    task.assigneeId = document.getElementById('task-assignee').value;
    persist('tasks');
    addActivity(`Tarefa "${title}" atualizada`, 'task');
  }
  closeModal();
  renderTasks();
}

function editTask(taskId, col) {
  const task = state.tasks[col].find(t => t.id === taskId);
  if (task) openTaskModal(col, task);
}

// ==================== TEAM ====================
function renderTeam() {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';

  if (state.members.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">group_add</span>
        <p class="font-headline-md text-headline-md mb-xs">Nenhum membro ainda</p>
        <p class="font-label-md text-label-md text-on-surface-variant">Adicione o primeiro membro da equipe.</p>
      </div>
    `;
    return;
  }

  state.members.forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-card';
    const color = getAvatarColor(m.name);
    const coverContent = m.photo
      ? `<img class="member-cover-img" src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.name)}">`
      : `<div class="member-cover-initials" style="background:linear-gradient(135deg, ${color}, ${color}dd)">${getInitials(m.name)}</div>`;
    card.innerHTML = `
      <div class="member-cover">
        ${coverContent}
        <span class="status-badge ${m.status === 'online' ? 'status-online' : 'status-offline'}">${m.status === 'online' ? 'Online' : 'Offline'}</span>
      </div>
      <div class="member-body">
        <h3 class="font-headline-md text-headline-md text-primary mb-xs">${escapeHtml(m.name)}</h3>
        <p class="font-label-md text-label-md text-on-surface-variant mb-md">${escapeHtml(m.role || 'Membro')}</p>
        <div class="flex items-center gap-xs">
          <button class="btn-icon p-xs border border-outline-variant rounded-lg" onclick="alert('Email: ${escapeHtml(m.email)}')" title="Email">
            <span class="material-symbols-outlined text-[20px]">mail</span>
          </button>
          <button class="btn-icon p-xs border border-outline-variant rounded-lg" onclick="alert('Chat com ${escapeHtml(m.name)}')" title="Chat">
            <span class="material-symbols-outlined text-[20px]">chat_bubble</span>
          </button>
          <button class="btn-icon p-xs border border-outline-variant rounded-lg ml-auto" onclick="editMember('${m.id}')" title="Editar">
            <span class="material-symbols-outlined text-[20px]">edit</span>
          </button>
          <button class="btn-icon p-xs border border-outline-variant rounded-lg danger" onclick="deleteMember('${m.id}')" title="Excluir">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function getAvatarColor(name) {
  const colors = ['#0f172a', '#1e40af', '#065f46', '#7c3aed', '#b45309', '#be123c', '#1d4ed8', '#047857'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function openMemberModal(editData) {
  const title = editData ? 'Editar Membro' : 'Adicionar Membro';
  const m = editData || { name: '', email: '', role: '', status: 'online', photo: '' };

  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="font-headline-md text-headline-md">${title}</h3>
        <button class="close-btn" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-input" id="member-name" value="${escapeHtml(m.name)}" placeholder="Nome completo">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="member-email" type="email" value="${escapeHtml(m.email)}" placeholder="email@exemplo.com">
        </div>
        <div class="form-group">
          <label class="form-label">Cargo</label>
          <input class="form-input" id="member-role" value="${escapeHtml(m.role)}" placeholder="Ex: Desenvolvedor">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="member-status">
            <option value="online" ${m.status === 'online' ? 'selected' : ''}>Online</option>
            <option value="offline" ${m.status === 'offline' ? 'selected' : ''}>Offline</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Foto de Perfil</label>
          <div class="photo-upload-area" id="photo-upload-area" onclick="document.getElementById('photo-input').click()">
            <span class="material-symbols-outlined" id="photo-icon">cloud_upload</span>
            <p class="upload-hint" id="photo-hint">Arraste uma foto ou <span>clique para upload</span></p>
            <p class="text-[10px] text-outline mt-1 uppercase tracking-wider">PNG, JPG até 5MB</p>
            <input type="file" id="photo-input" accept="image/*" onchange="previewPhoto(event)">
            <button class="photo-remove-btn hidden" id="photo-remove-btn" onclick="event.stopPropagation();removePhoto()" title="Remover foto">
              <span class="material-symbols-outlined" style="font-size:16px">close</span>
            </button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="${editData ? `saveMemberEdit('${m.id}')` : 'saveMember()'}">${editData ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');

  if (m.photo) {
    showPhotoPreview(m.photo);
  }
}

let _currentPhoto = '';

function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('A foto deve ter no máximo 5MB.'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    _currentPhoto = e.target.result;
    showPhotoPreview(_currentPhoto);
  };
  reader.readAsDataURL(file);
}

function showPhotoPreview(dataUrl) {
  const area = document.getElementById('photo-upload-area');
  const icon = document.getElementById('photo-icon');
  const hint = document.getElementById('photo-hint');
  const removeBtn = document.getElementById('photo-remove-btn');
  if (!area) return;

  icon.style.display = 'none';
  hint.style.display = 'none';
  const existing = area.querySelector('img');
  if (existing) existing.remove();
  removeBtn.classList.remove('hidden');

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Preview';
  area.insertBefore(img, removeBtn);
  _currentPhoto = dataUrl;
}

function removePhoto() {
  _currentPhoto = '';
  const area = document.getElementById('photo-upload-area');
  const icon = document.getElementById('photo-icon');
  const hint = document.getElementById('photo-hint');
  const removeBtn = document.getElementById('photo-remove-btn');
  const input = document.getElementById('photo-input');
  if (!area) return;
  icon.style.display = '';
  hint.style.display = '';
  removeBtn.classList.add('hidden');
  const img = area.querySelector('img');
  if (img) img.remove();
  if (input) input.value = '';
}

function saveMember() {
  const name = document.getElementById('member-name').value.trim();
  if (!name) { alert('O nome é obrigatório.'); return; }

  state.members.push({
    id: uid(),
    name,
    email: document.getElementById('member-email').value.trim(),
    role: document.getElementById('member-role').value.trim(),
    status: document.getElementById('member-status').value,
    photo: _currentPhoto || ''
  });
  _currentPhoto = '';
  persist('members');
  addActivity(`Membro "${name}" adicionado à equipe`, 'member');
  closeModal();
  renderTeam();
}

function saveMemberEdit(id) {
  const name = document.getElementById('member-name').value.trim();
  if (!name) { alert('O nome é obrigatório.'); return; }

  const m = state.members.find(x => x.id === id);
  if (m) {
    m.name = name;
    m.email = document.getElementById('member-email').value.trim();
    m.role = document.getElementById('member-role').value.trim();
    m.status = document.getElementById('member-status').value;
    if (_currentPhoto) m.photo = _currentPhoto;
    _currentPhoto = '';
    persist('members');
    addActivity(`Membro "${name}" atualizado`, 'member');
  }
  closeModal();
  renderTeam();
}

function editMember(id) {
  const m = state.members.find(x => x.id === id);
  if (m) openMemberModal(m);
}

function deleteMember(id) {
  if (!confirm('Remover este membro?')) return;
  const m = state.members.find(x => x.id === id);
  state.members = state.members.filter(x => x.id !== id);
  persist('members');
  addActivity(`Membro "${m ? m.name : ''}" removido`, 'member');
  renderTeam();
}

// ==================== FILES ====================
function renderFiles() {
  const foldersGrid = document.getElementById('folders-grid');
  foldersGrid.innerHTML = '';

  const filesTbody = document.getElementById('files-tbody');
  const filesCount = document.getElementById('files-count');

  // Render folders
  if (state.folders.length === 0) {
    // no folders yet — show nothing in grid area
  } else {
    state.folders.forEach(f => {
      const fileCount = state.files.filter(file => file.folderId === f.id).length;
      const div = document.createElement('div');
      div.className = 'folder-card';
      div.innerHTML = `
        <div class="flex justify-between items-start mb-sm">
          <span class="material-symbols-outlined folder-icon" style="color: ${f.color || 'var(--secondary)'}; font-variation-settings: 'FILL' 1">folder</span>
          <button class="text-outline hover:text-on-surface" onclick="deleteFolder('${f.id}')"><span class="material-symbols-outlined text-[20px]">more_vert</span></button>
        </div>
        <h4 class="font-label-md text-label-md text-on-surface truncate">${escapeHtml(f.name)}</h4>
        <span class="text-label-sm font-label-sm text-outline">${fileCount} arquivo${fileCount !== 1 ? 's' : ''}</span>
      `;
      foldersGrid.appendChild(div);
    });
  }

  // Render files table
  if (state.files.length === 0) {
    filesTbody.innerHTML = `
      <tr><td colspan="5" class="text-center text-on-surface-variant font-label-md" style="padding:32px">Nenhum arquivo adicionado.</td></tr>
    `;
    filesCount.textContent = 'Nenhum arquivo';
  } else {
    filesTbody.innerHTML = '';
    state.files.forEach(f => {
      const tr = document.createElement('tr');
      tr.className = 'group';
      const [fileIcon, fileColor] = getFileIconAndColor(f.type);
      const sizeDisplay = f.sizeLabel || (f.size ? (typeof f.size === 'number' ? formatFileSize(f.size) : f.size) : '—');
      tr.innerHTML = `
        <td>
          <div class="flex items-center gap-sm">
            <div class="file-icon" style="background:${fileColor.bg};color:${fileColor.text}">
              <span class="material-symbols-outlined">${fileIcon}</span>
            </div>
            <span class="font-label-md text-label-md text-on-surface">${escapeHtml(f.name)}</span>
          </div>
        </td>
        <td class="text-body-md text-on-surface-variant">${escapeHtml(f.type || '—')}</td>
        <td class="text-body-md text-on-surface-variant">${escapeHtml(sizeDisplay)}</td>
        <td class="text-body-md text-on-surface-variant">${f.date ? formatDate(f.date) : '—'}</td>
        <td class="text-right">
          <div class="file-actions">
            <button class="btn-icon" onclick="downloadFile('${f.id}')" title="Download"><span class="material-symbols-outlined text-[20px]">download</span></button>
            <button class="btn-icon" onclick="alert('Compartilhar ${escapeHtml(f.name)}')" title="Compartilhar"><span class="material-symbols-outlined text-[20px]">share</span></button>
            <button class="btn-icon danger" onclick="deleteFile('${f.id}')" title="Excluir"><span class="material-symbols-outlined text-[20px]">delete</span></button>
          </div>
        </td>
      `;
      filesTbody.appendChild(tr);
    });
    filesCount.textContent = `Mostrando ${state.files.length} arquivo${state.files.length !== 1 ? 's' : ''}`;
  }
}

function downloadFile(id) {
  const f = state.files.find(x => x.id === id);
  if (!f || !f.data) return;
  const link = document.createElement('a');
  link.href = f.data;
  link.download = f.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  const units = ['B', 'KB', 'MB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function detectFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { pdf: 'PDF', doc: 'DOCX', docx: 'DOCX', xls: 'XLSX', xlsx: 'XLSX', png: 'PNG', jpg: 'JPG', jpeg: 'JPG', zip: 'ZIP', rar: 'ZIP', mp4: 'MP4', mov: 'MP4', avi: 'MP4', gif: 'PNG', svg: 'PNG', webp: 'PNG', txt: 'DOCX', csv: 'XLSX', json: 'DOCX', xml: 'DOCX', ppt: 'DOCX', pptx: 'DOCX' };
  return map[ext] || 'DOCX';
}

function getFileIconAndColor(type) {
  const icons = { PDF: 'picture_as_pdf', DOCX: 'description', XLSX: 'table_chart', PNG: 'image', JPG: 'image', ZIP: 'folder_zip', MP4: 'movie' };
  const colors = {
    PDF: { bg: '#fef2f2', text: '#dc2626' },
    DOCX: { bg: '#eff6ff', text: '#2563eb' },
    XLSX: { bg: '#f0fdf4', text: '#16a34a' },
    PNG: { bg: '#faf5ff', text: '#9333ea' },
    JPG: { bg: '#faf5ff', text: '#9333ea' },
    ZIP: { bg: '#fffbeb', text: '#d97706' }
  };
  return [icons[type] || 'description', colors[type] || { bg: '#f1f5f9', text: '#64748b' }];
}

function openFolderModal() {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="font-headline-md text-headline-md">Nova Pasta</h3>
        <button class="close-btn" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome da Pasta</label>
          <input class="form-input" id="folder-name" placeholder="Ex: Projetos Ativos">
        </div>
        <div class="form-group">
          <label class="form-label">Cor</label>
          <select class="form-select" id="folder-color">
            <option value="#10b981">Verde</option>
            <option value="#3b82f6">Azul</option>
            <option value="#8b5cf6">Roxo</option>
            <option value="#f59e0b">Âmbar</option>
            <option value="#ef4444">Vermelho</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveFolder()">Criar</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveFolder() {
  const name = document.getElementById('folder-name').value.trim();
  if (!name) { alert('O nome é obrigatório.'); return; }

  state.folders.push({
    id: uid(),
    name,
    color: document.getElementById('folder-color').value
  });
  persist('folders');
  addActivity(`Pasta "${name}" criada`, 'folder');
  closeModal();
  renderFiles();
}

function deleteFolder(id) {
  if (!confirm('Excluir esta pasta?')) return;
  const f = state.folders.find(x => x.id === id);
  state.folders = state.folders.filter(x => x.id !== id);
  persist('folders');
  addActivity(`Pasta "${f ? f.name : ''}" excluída`, 'folder');
  renderFiles();
}

let _selectedFile = null;

function openFileModal() {
  _selectedFile = null;
  const container = document.getElementById('modal-container');
  const folderOptions = state.folders.map(f =>
    `<option value="${f.id}">${escapeHtml(f.name)}</option>`
  ).join('');

  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="font-headline-md text-headline-md">Adicionar Arquivo</h3>
        <button class="close-btn" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Selecionar Arquivo</label>
          <div class="file-upload-area" id="file-upload-area" onclick="document.getElementById('file-input').click()">
            <span class="material-symbols-outlined" id="file-upload-icon">upload_file</span>
            <p class="upload-hint" id="file-upload-hint">Clique para selecionar ou arraste um arquivo</p>
            <p class="text-[10px] text-outline mt-1 uppercase tracking-wider">Máximo 2MB</p>
            <input type="file" id="file-input" onchange="selectFile(event)">
          </div>
          <div id="file-info" class="hidden" style="margin-top:8px">
            <div class="flex items-center gap-sm p-sm" style="background:var(--surface-container-low);border-radius:var(--radius-md)">
              <div class="file-icon" id="file-info-icon" style="background:#eff6ff;color:#2563eb"><span class="material-symbols-outlined">description</span></div>
              <div class="flex-1 min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate" id="file-info-name"></p>
                <p class="text-label-sm font-label-sm text-outline" id="file-info-size"></p>
              </div>
              <button class="btn-icon danger" onclick="removeSelectedFile()" title="Remover"><span class="material-symbols-outlined text-[20px]">close</span></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Pasta</label>
          <select class="form-select" id="file-folder">
            <option value="">Nenhuma</option>
            ${folderOptions}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveFile()">Adicionar</button>
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function selectFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert('O arquivo deve ter no máximo 2MB.'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    _selectedFile = {
      name: file.name,
      type: detectFileType(file.name),
      size: file.size,
      data: e.target.result
    };
    showFileInfo(_selectedFile);
  };
  reader.readAsDataURL(file);
}

function showFileInfo(file) {
  const area = document.getElementById('file-upload-area');
  const icon = document.getElementById('file-upload-icon');
  const hint = document.getElementById('file-upload-hint');
  const info = document.getElementById('file-info');
  const infoIcon = document.getElementById('file-info-icon');
  const infoName = document.getElementById('file-info-name');
  const infoSize = document.getElementById('file-info-size');
  if (!area) return;

  icon.style.display = 'none';
  hint.textContent = 'Arquivo selecionado';
  info.classList.remove('hidden');

  const [fileIcon, fileColor] = getFileIconAndColor(file.type);
  infoIcon.style.background = fileColor.bg;
  infoIcon.style.color = fileColor.text;
  infoIcon.innerHTML = `<span class="material-symbols-outlined">${fileIcon}</span>`;
  infoName.textContent = file.name;
  infoSize.textContent = formatFileSize(file.size);
}

function removeSelectedFile() {
  _selectedFile = null;
  const area = document.getElementById('file-upload-area');
  const icon = document.getElementById('file-upload-icon');
  const hint = document.getElementById('file-upload-hint');
  const info = document.getElementById('file-info');
  const input = document.getElementById('file-input');
  if (!area) return;
  icon.style.display = '';
  hint.textContent = 'Clique para selecionar ou arraste um arquivo';
  info.classList.add('hidden');
  if (input) input.value = '';
}

function saveFile() {
  if (!_selectedFile) { alert('Selecione um arquivo primeiro.'); return; }

  const f = _selectedFile;
  state.files.push({
    id: uid(),
    name: f.name,
    type: f.type,
    size: f.size,
    sizeLabel: formatFileSize(f.size),
    data: f.data,
    folderId: document.getElementById('file-folder').value,
    date: now()
  });
  _selectedFile = null;
  persist('files');
  addActivity(`Arquivo "${f.name}" adicionado`, 'file');
  closeModal();
  renderFiles();
}

function deleteFile(id) {
  if (!confirm('Excluir este arquivo?')) return;
  const f = state.files.find(x => x.id === id);
  state.files = state.files.filter(x => x.id !== id);
  persist('files');
  addActivity(`Arquivo "${f ? f.name : ''}" excluído`, 'file');
  renderFiles();
}

// ==================== MODAL ====================
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').innerHTML = '';
}

// ==================== UTILS ====================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== INIT ====================
initState();
window.addEventListener('hashchange', handleRoute);
handleRoute();
