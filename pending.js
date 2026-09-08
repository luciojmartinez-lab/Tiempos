const pendingUI = { editingId: null, month: todayISO().slice(0, 7), day: "", filter: "open" };
const repeatLabels = { "": "No repetir", daily: "Diaria", weekly: "Semanal", monthly: "Mensual", yearly: "Anual" };

function initPending() {
  const view = document.createElement("section");
  view.className = "view pending-view";
  view.dataset.screen = "pendientes";
  view.innerHTML = `<div class="pending-head"><div><h1>Pendientes</h1><p>Lo que tienes por hacer, con o sin fecha.</p></div><button class="btn" type="button" id="pending-new">+ Nuevo pendiente</button></div>
    <p id="pending-message" role="status"></p>
    <form id="pending-form" class="pending-editor" hidden>
      <h2 id="pending-form-title">Nuevo pendiente</h2>
      <div class="pending-fields">
        <label>Categoría<select id="pending-task" required></select></label>
        <label class="pending-wide">Descripción<input id="pending-description" required maxlength="500"></label>
        <label class="pending-wide">Notas<textarea id="pending-notes" rows="2" maxlength="5000"></textarea></label>
        <label>Inicio previsto (opcional)<input type="date" id="pending-start"></label>
        <label>Vencimiento (opcional)<input type="date" id="pending-due"></label>
        <label>Repetición<select id="pending-repeat">${Object.entries(repeatLabels).map(([v,t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
      </div><p class="pending-help">Para repetir, indica al menos una fecha. Al completar se crea la siguiente aparición futura; los meses cortos usan su último día.</p>
      <p id="pending-error" role="alert"></p><div class="pending-actions"><button class="btn" type="submit">Guardar pendiente</button><button class="ghost" type="button" id="pending-cancel">Cancelar</button></div>
    </form>
    <div class="pending-layout"><section class="pending-list-panel" aria-label="Lista de pendientes">
      <div class="pending-filters"><label>Mostrar<select id="pending-filter"><option value="open">Pendientes</option><option value="overdue">Vencidas</option><option value="today">Para hoy</option><option value="timeless">Sin fechas</option><option value="completed">Completadas</option><option value="deleted">Papelera</option></select></label><button type="button" class="ghost" id="pending-clear-day" hidden>Quitar filtro de día</button></div>
      <p id="pending-count"></p><div id="pending-list"></div></section>
      <section class="pending-calendar-panel" aria-label="Calendario de pendientes"><div class="pending-calendar-head"><button type="button" class="ghost" id="pending-prev" aria-label="Mes anterior">‹</button><h2 id="pending-month"></h2><button type="button" class="ghost" id="pending-next" aria-label="Mes siguiente">›</button></div><button class="ghost" type="button" id="pending-today">Mes actual</button>
      <p class="pending-legend"><span class="pending-start-marker">Azul: Inicio</span><span class="pending-due-marker">Rojo: Vence</span></p><div id="pending-calendar" class="pending-calendar"></div><p class="pending-help">Pulsa un día para ver sus tareas. Las tareas sin fechas aparecen en la lista.</p></section></div>`;
  document.querySelector('.main-container').append(view);
  els.navItems = document.querySelectorAll('.nav-item');
  els.views = document.querySelectorAll('.view');
  document.getElementById('pending-new').addEventListener('click', () => editPending());
  document.getElementById('pending-cancel').addEventListener('click', closePendingEditor);
  document.getElementById('pending-form').addEventListener('submit', savePending);
  document.getElementById('pending-filter').addEventListener('change', event => { pendingUI.filter = event.target.value; pendingUI.day = ""; renderPending(); });
  document.getElementById('pending-clear-day').addEventListener('click', () => { pendingUI.day = ""; renderPending(); });
  document.getElementById('pending-list').addEventListener('click', pendingAction);
  document.getElementById('pending-calendar').addEventListener('click', event => {
    const button = event.target.closest('[data-day]'); if (!button) return;
    pendingUI.day = button.dataset.day; pendingUI.filter = 'open'; renderPending();
    document.getElementById('pending-count').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  for (const [id, offset] of [['pending-prev', -1], ['pending-next', 1]]) document.getElementById(id).addEventListener('click', () => {
    const date = new Date(pendingUI.month + '-01T12:00:00'); date.setMonth(date.getMonth() + offset);
    pendingUI.month = toISODate(date).slice(0, 7); pendingUI.day = ''; renderPending();
  });
  document.getElementById('pending-today').addEventListener('click', () => { pendingUI.month = todayISO().slice(0, 7); pendingUI.day = ''; renderPending(); });
}

function pendingMessage(message) { document.getElementById('pending-message').textContent = message; }

function editPending(id = '') {
  const item = state.pendingTasks.find(p => p.id === id);
  pendingUI.editingId = item?.id || null;
  const taskSelect = document.getElementById('pending-task');
  const tasks = uniqueTasks([...getTaskList(), ...(item?.task ? [item.task] : [])]);
  taskSelect.innerHTML = tasks.map(task => `<option value="${escapeAttr(task)}">${escapeHtml(task)}</option>`).join('');
  taskSelect.value = item?.task || tasks[0] || '';
  for (const [id, value] of [['description', item?.description], ['notes', item?.notes], ['start', item?.startDate], ['due', item?.dueDate], ['repeat', item?.repeat]]) document.getElementById('pending-' + id).value = value || '';
  document.getElementById('pending-form-title').textContent = item ? 'Editar pendiente' : 'Nuevo pendiente';
  document.getElementById('pending-error').textContent = '';
  document.getElementById('pending-form').hidden = false;
  document.getElementById('pending-description').focus();
}

function closePendingEditor() { document.getElementById('pending-form').hidden = true; pendingUI.editingId = null; }

function savePending(event) {
  event.preventDefault();
  const value = id => document.getElementById('pending-' + id).value.trim();
  const previous = state.pendingTasks.find(p => p.id === pendingUI.editingId);
  const startDate = value('start'), dueDate = value('due'), repeat = value('repeat');
  let error = '';
  if (!value('description')) error = 'Escribe una descripción.';
  else if (startDate && dueDate && dueDate < startDate) error = 'El vencimiento no puede ser anterior al inicio previsto.';
  else if (repeat && !startDate && !dueDate) error = 'Indica inicio previsto o vencimiento para calcular la repetición.';
  if (error) { document.getElementById('pending-error').textContent = error; return; }
  const timestamp = new Date().toISOString(), id = previous?.id || createId();
  const changedSchedule = !previous || previous.startDate !== startDate || previous.dueDate !== dueDate || previous.repeat !== repeat;
  const item = normalizePendingTask({ ...previous, id, task: value('task'), description: value('description'), notes: value('notes'), startDate, dueDate, repeat,
    ...(changedSchedule ? { seriesId: id, anchorStart: startDate, anchorDue: dueDate, repeatIndex: 0, nextPendingId: '' } : {}),
    createdAt: previous?.createdAt || timestamp, updatedAt: timestamp });
  state.pendingTasks = state.pendingTasks.filter(p => p.id !== id).concat(item);
  persistPendingTasks(); closePendingEditor(); renderPending(); scheduleAutoSync(300);
  pendingMessage('Pendiente guardado.');
}

function renderPending() {
  if (!document.getElementById('pending-list')) return;
  const today = todayISO();
  const open = state.pendingTasks.filter(p => !p.deletedAt && !p.completedAt);
  const list = state.pendingTasks.filter(p => {
    if (pendingUI.filter === 'deleted') return Boolean(p.deletedAt);
    if (p.deletedAt) return false;
    if (pendingUI.filter === 'completed') return Boolean(p.completedAt);
    if (p.completedAt) return false;
    if (pendingUI.day && p.startDate !== pendingUI.day && p.dueDate !== pendingUI.day) return false;
    if (pendingUI.filter === 'overdue') return pendingOverdueDays(p, today) > 0;
    if (pendingUI.filter === 'today') return p.startDate === today || p.dueDate === today;
    if (pendingUI.filter === 'timeless') return !p.startDate && !p.dueDate;
    return true;
  }).sort(comparePendingTasks);
  document.getElementById('pending-filter').value = pendingUI.filter;
  document.getElementById('pending-clear-day').hidden = !pendingUI.day;
  document.getElementById('pending-count').textContent = `${list.length} ${list.length === 1 ? 'tarea' : 'tareas'}${pendingUI.day ? ' · ' + formatDate(pendingUI.day) : ''} · Orden por inicio previsto; sin inicio, al final.`;
  document.getElementById('pending-list').innerHTML = list.map(p => {
    const linked = state.entries.filter(e => e.pendingId === p.id);
    const active = linked.find(e => e.status === 'active');
    const overdue = pendingOverdueDays(p, today);
    const total = minutesToDuration(linked.reduce((sum, e) => sum + computeEntryMilliseconds(e), 0) / 60000);
    const action = (name, title) => `<button class="ghost" type="button" data-pending-action="${name}">${title}</button>`;
    return `<article class="pending-card${overdue ? ' overdue' : ''}" data-pending-id="${escapeAttr(p.id)}"><span class="pending-category">${escapeHtml(p.task)}</span><h3>${escapeHtml(p.description)}</h3>${p.notes ? `<p class="pending-notes">${escapeHtml(p.notes)}</p>` : ''}
    <div class="pending-meta"><span class="pending-start-marker">${p.startDate ? 'Inicio: ' + formatDate(p.startDate) : 'Sin inicio previsto'}</span><span class="pending-due-marker">${p.dueDate ? 'Vence: ' + formatDate(p.dueDate) : 'Sin vencimiento'}</span>${overdue ? `<strong class="pending-late">${overdue} ${overdue === 1 ? 'día' : 'días'} de retraso</strong>` : !p.completedAt && p.dueDate === today ? '<strong>Vence hoy</strong>' : ''}${p.repeat ? `<span>Repetición: ${repeatLabels[p.repeat]}</span>` : ''}${p.completedAt ? '<strong>Completada</strong>' : ''}</div>
    <p class="pending-time">${linked.length} ${linked.length === 1 ? 'sesión' : 'sesiones'} · Tiempo dedicado: ${total}${active ? ' · En curso' : ''}</p>
    <div class="pending-actions">${p.deletedAt ? action('restore', 'Restaurar') : (p.completedAt ? action('reopen', 'Reabrir') : action('start', active ? 'Ver sesión activa' : 'Iniciar ahora') + action('complete', 'Completar')) + action('edit', 'Editar') + action('delete', 'A papelera')}${linked.length ? action('sessions', 'Ver sesiones') : ''}</div></article>`;
  }).join('') || '<p class="pending-empty">No hay tareas en esta vista. Puedes añadir un nuevo pendiente.</p>';
  renderPendingCalendar(open);
}

function renderPendingCalendar(open) {
  const first = new Date(pendingUI.month + '-01T12:00:00');
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  document.getElementById('pending-month').textContent = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  let html = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => `<span class="pending-weekday">${d}</span>`).join('');
  html += '<span></span>'.repeat(offset);
  for (let day = 1; day <= count; day++) {
    const date = pendingUI.month + '-' + String(day).padStart(2, '0');
    const starts = open.filter(p => p.startDate === date).length, dues = open.filter(p => p.dueDate === date).length;
    html += `<button type="button" data-day="${date}" class="pending-day${date === todayISO() ? ' today' : ''}" aria-pressed="${pendingUI.day === date}" aria-label="${formatDate(date)}, ${starts} inicios, ${dues} vencimientos"><span>${day}</span>${starts ? `<small class="pending-start-marker">Inicio ${starts}</small>` : ''}${dues ? `<small class="pending-due-marker">Vence ${dues}</small>` : ''}</button>`;
  }
  document.getElementById('pending-calendar').innerHTML = html;
}

function pendingAction(event) {
  const button = event.target.closest('[data-pending-action]'); if (!button) return;
  const item = state.pendingTasks.find(p => p.id === button.closest('[data-pending-id]').dataset.pendingId); if (!item) return;
  const action = button.dataset.pendingAction;
  if (action === 'edit') { editPending(item.id); return; }
  if (action === 'sessions') { showPendingSessions(item); return; }
  if (action === 'start') { startPendingNow(item); return; }
  if (action === 'complete' && state.entries.some(e => e.pendingId === item.id && e.status === 'active')) { pendingMessage('Finaliza o pausa la sesión activa antes de completar el pendiente.'); return; }
  const timestamp = new Date().toISOString();
  if (action === 'complete') {
    state.entries.filter(e => e.pendingId === item.id && e.status === 'paused').forEach(e => finishTrackedEntry(e.id));
    item.completedAt = timestamp;
    if (!item.nextPendingId) {
      const next = nextPendingOccurrence(item, todayISO(), timestamp);
      if (next) { if (!state.pendingTasks.some(p => p.id === next.id)) state.pendingTasks.push(next); item.nextPendingId = next.id; }
    }
  }
  if (action === 'reopen') item.completedAt = '';
  if (action === 'delete') item.deletedAt = timestamp;
  if (action === 'restore') item.deletedAt = '';
  item.updatedAt = timestamp;
  persistPendingTasks(); renderPending(); scheduleAutoSync(300);
  pendingMessage(action === 'complete' ? (item.nextPendingId ? 'Completada. La siguiente aparición está en Pendientes.' : 'Tarea completada.') : action === 'delete' ? 'Enviada a la papelera. Puedes restaurarla.' : 'Pendiente actualizado.');
}

function startPendingNow(item) {
  const active = state.entries.find(e => e.pendingId === item.id && e.status === 'active');
  if (active) { setView('datos'); return; }
  const now = new Date(), timestamp = now.toISOString();
  if (!state.tracking.allowSimultaneous) pauseOtherActiveEntries(now);
  // Reuse the paused session so a pending task cannot accumulate abandoned timers.
  const paused = state.entries.find(e => e.pendingId === item.id && e.status === 'paused');
  if (paused) resumeTrackedEntry(paused.id);
  else {
    state.entries.push(normalizeEntry({ id: createId(), pendingId: item.id, task: item.task, description: item.description, notes: item.notes,
      date: toISODate(now), startDate: toISODate(now), start: formatTimeFromDate(now), end: '',
      createdAt: timestamp, updatedAt: timestamp, statusUpdatedAt: timestamp, tracked: true, status: 'active', syncVersion: APP_VERSION,
      segments: [{ id: createId(), startAt: timestamp, endAt: '', updatedAt: timestamp }] }));
    persist(); render(); scheduleAutoSync(300);
  }
  setView('datos');
}

function showPendingSessions(item) {
  const dialog = document.createElement('dialog'); dialog.className = 'pending-sessions'; dialog.setAttribute('aria-label', 'Sesiones del pendiente');
  const sessions = state.entries.filter(e => e.pendingId === item.id).sort(compareEntries);
  dialog.innerHTML = `<h2>${escapeHtml(item.description)}</h2><ul>${sessions.map(e => `<li>${formatDate(e.startDate || e.date)} · ${escapeHtml(e.start)} · ${minutesToDuration(computeEntryMinutes(e))} · ${e.status === 'active' ? 'En curso' : e.status === 'paused' ? 'Pausada' : 'Finalizada'}</li>`).join('')}</ul><button type="button" class="btn">Cerrar</button>`;
  const previous = document.activeElement;
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); }); document.body.append(dialog); dialog.showModal();
}
