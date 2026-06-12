const STORAGE_KEY = "tiempos.entries.100v1";
const CUSTOM_TASKS_KEY = "tiempos.customTasks.100v2";
const DELETED_TASKS_KEY = "tiempos.deletedTasks.100v3";
const DELETED_ENTRIES_KEY = "tiempos.deletedEntries.100v11";
const SYNC_SETTINGS_KEY = "tiempos.syncSettings.100v11";
const APP_VERSION = "100v15";
const ALL_YEARS_VALUE = "all";
const SYNC_ENDPOINT = "/api/sync";
const BULK_MIGRATION_LIMIT = 5;
const LEGACY_UPDATED_AT = "2000-01-01T00:00:00.000Z";

const TASKS = [
  "UNI",
  "MASTERS",
  "PROGRAMACION",
  "ENTRENO",
  "CONTABILIDAD",
  "VIAJES",
  "FOTOGRAFIA",
  "INFORMATICA",
];

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const SAMPLE_ENTRIES = [
  {
    id: "demo-1",
    date: "2026-06-01",
    task: "PROGRAMACION",
    description: "Entrar datos",
    notes: "",
    start: "09:00",
    end: "11:20",
  },
  {
    id: "demo-2",
    date: "2026-06-01",
    task: "CONTABILIDAD",
    description: "Revision",
    notes: "",
    start: "12:15",
    end: "13:05",
  },
  {
    id: "demo-3",
    date: "2026-06-02",
    task: "UNI",
    description: "Entrar datos competiciones",
    notes: "",
    start: "18:00",
    end: "20:30",
  },
  {
    id: "demo-4",
    date: "2026-06-04",
    task: "INFORMATICA",
    description: "Facturas",
    notes: "",
    start: "11:00",
    end: "14:00",
  },
  {
    id: "demo-5",
    date: "2026-06-05",
    task: "ENTRENO",
    description: "Entrar datos",
    notes: "",
    start: "07:20",
    end: "09:05",
  },
  {
    id: "demo-6",
    date: "2026-06-09",
    task: "MASTERS",
    description: "Entrar datos",
    notes: "",
    start: "19:30",
    end: "20:45",
  },
];

const state = {
  entries: loadEntries(),
  customTasks: loadCustomTasks(),
  deletedTasks: loadDeletedTasks(),
  deletedEntries: loadDeletedEntries(),
  sync: loadSyncSettings(),
  editingId: null,
  search: "",
  dateFilter: "",
  sortOrder: "desc",
  chartYear: currentYear(),
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindElements();
  buildTaskControls();
  bindEvents();
  setSyncFormValues();
  setTodayIfEmpty();
  updateDateFilterState();
  updateSyncStatus();
  render();
  setInitialView();
  scheduleAutoSync(1000);
  registerServiceWorker();
  checkForAppUpdate();
}

function bindElements() {
  Object.assign(els, {
    navItems: document.querySelectorAll(".nav-item"),
    views: document.querySelectorAll(".view"),
    taskButtons: document.getElementById("task-buttons"),
    newTaskInput: document.getElementById("new-task-input"),
    addTask: document.getElementById("add-task"),
    deleteTask: document.getElementById("delete-task"),
    syncKey: document.getElementById("sync-key"),
    saveSyncKey: document.getElementById("save-sync-key"),
    syncNow: document.getElementById("sync-now"),
    syncPull: document.getElementById("sync-pull"),
    syncReplace: document.getElementById("sync-replace"),
    syncAuto: document.getElementById("sync-auto"),
    syncStatus: document.getElementById("sync-status"),
    entryPanel: document.querySelector(".entry-panel"),
    openEntry: document.getElementById("open-entry-modal"),
    closeEntry: document.getElementById("close-entry-modal"),
    taskSelect: document.getElementById("entry-task"),
    form: document.getElementById("entry-form"),
    date: document.getElementById("entry-date"),
    task: document.getElementById("entry-task"),
    description: document.getElementById("entry-description"),
    notes: document.getElementById("entry-notes"),
    start: document.getElementById("entry-start"),
    end: document.getElementById("entry-end"),
    save: document.getElementById("save-entry"),
    clear: document.getElementById("clear-form"),
    remove: document.getElementById("delete-entry"),
    loadFile: document.getElementById("load-file"),
    fileInput: document.getElementById("file-input"),
    exportCsv: document.getElementById("export-csv"),
    exportJson: document.getElementById("export-json"),
    search: document.getElementById("search-box"),
    dateFilter: document.getElementById("date-filter"),
    clearDateFilter: document.getElementById("clear-date-filter"),
    sortOrder: document.getElementById("sort-order"),
    body: document.getElementById("entries-body"),
    mobileList: document.getElementById("mobile-list"),
    statAverage: document.getElementById("stat-average"),
    statTotal: document.getElementById("stat-total"),
    statDays: document.getElementById("stat-days"),
    statEntries: document.getElementById("stat-entries"),
    chartTotal: document.getElementById("chart-total"),
    chartTopTask: document.getElementById("chart-top-task"),
    chartYearFilter: document.getElementById("chart-year-filter"),
    chartTopMonth: document.getElementById("chart-top-month"),
    taskSummary: document.getElementById("task-summary"),
    taskChart: document.getElementById("task-chart"),
    monthSummary: document.getElementById("month-summary"),
    monthChart: document.getElementById("month-chart"),
  });
}

function buildTaskControls() {
  const taskList = getTaskList();

  els.task.innerHTML = taskList
    .map(
      (task) => `<option value="${escapeAttr(task)}">${escapeHtml(task)}</option>`,
    )
    .join("");

  els.taskButtons.innerHTML = taskList
    .map(
      (task) =>
        `<button class="task-button" type="button" data-task="${escapeAttr(
          task,
        )}">${escapeHtml(task)}</button>`,
    )
    .join("");
}

function getTaskList() {
  const deletedTasks = new Set(state.deletedTasks);
  const baseTasks = TASKS.filter((task) => !deletedTasks.has(task));
  const customTasks = state.customTasks.filter((task) => !TASKS.includes(task));
  const extras = state.entries
    .map((entry) => cleanText(entry.task).toUpperCase())
    .filter((task) => task && !TASKS.includes(task));
  return [...baseTasks, ...new Set([...customTasks, ...extras])].filter(
    (task) => !deletedTasks.has(task),
  );
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.taskButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task]");
    if (!button) return;
    els.task.value = button.dataset.task;
    updateTaskButtonState();
  });

  els.task.addEventListener("change", updateTaskButtonState);
  els.addTask.addEventListener("click", addTaskFromInput);
  els.deleteTask.addEventListener("click", deleteSelectedTask);
  els.saveSyncKey.addEventListener("click", saveSyncSettingsFromForm);
  els.syncNow.addEventListener("click", () => syncNow({ silent: false }));
  els.syncPull.addEventListener("click", pullCloudToThisDevice);
  els.syncReplace.addEventListener("click", replaceCloudFromThisDevice);
  els.syncAuto.addEventListener("change", () => {
    state.sync.auto = els.syncAuto.checked;
    saveSyncSettings();
    updateSyncStatus();
    scheduleAutoSync(800);
  });
  els.newTaskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTaskFromInput();
    }
  });
  els.openEntry.addEventListener("click", startNewEntryFromButton);
  els.closeEntry.addEventListener("click", closeEntryModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEntryModal();
  });
  els.clear.addEventListener("click", resetForm);
  els.remove.addEventListener("click", deleteCurrent);
  els.form.addEventListener("submit", saveCurrent);
  els.search.addEventListener("input", () => {
    state.search = els.search.value.trim().toLowerCase();
    renderEntries();
  });
  els.dateFilter.addEventListener("change", () => {
    state.dateFilter = els.dateFilter.value;
    updateDateFilterState();
    renderEntries();
  });
  els.clearDateFilter.addEventListener("click", () => {
    state.dateFilter = "";
    els.dateFilter.value = "";
    updateDateFilterState();
    renderEntries();
  });
  els.sortOrder.addEventListener("change", () => {
    state.sortOrder = els.sortOrder.value;
    renderEntries();
  });
  els.chartYearFilter.addEventListener("change", () => {
    state.chartYear = els.chartYearFilter.value;
    renderCharts();
  });
  els.loadFile.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", handleFileLoad);
  els.exportCsv.addEventListener("click", exportCsv);
  els.exportJson.addEventListener("click", exportJson);
  window.addEventListener("online", () => scheduleAutoSync(500));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleAutoSync(500);
  });
}

function setView(view) {
  document.body.dataset.activeView = view;
  els.navItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.views.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === view);
  });
}

function addTaskFromInput() {
  const task = cleanText(els.newTaskInput.value).toUpperCase();
  if (!task) return;
  state.deletedTasks = state.deletedTasks.filter((item) => item !== task);
  persistDeletedTasks();
  if (!getTaskList().includes(task)) {
    state.customTasks.push(task);
    persistCustomTasks();
  }
  buildTaskControls();
  els.task.value = task;
  els.newTaskInput.value = "";
  updateTaskButtonState();
}

function deleteSelectedTask() {
  const task = cleanText(els.task.value).toUpperCase();
  if (!task) return;

  const taskHasEntries = state.entries.some(
    (entry) => cleanText(entry.task).toUpperCase() === task,
  );

  if (taskHasEntries) {
    alert("No se puede eliminar una tarea que ya tiene registros.");
    return;
  }

  state.customTasks = state.customTasks.filter((item) => item !== task);
  if (!state.deletedTasks.includes(task)) {
    state.deletedTasks.push(task);
  }

  persistCustomTasks();
  persistDeletedTasks();
  buildTaskControls();
  els.task.value = getTaskList()[0] || "";
  updateTaskButtonState();
}

function setSyncFormValues() {
  els.syncKey.value = state.sync.key || "";
  els.syncAuto.checked = Boolean(state.sync.auto);
}

function saveSyncSettingsFromForm() {
  state.sync.key = cleanText(els.syncKey.value);
  state.sync.auto = els.syncAuto.checked;
  saveSyncSettings();
  updateSyncStatus("Configuracion guardada", "ok");
  scheduleAutoSync(500);
}

function updateSyncStatus(message, type = "") {
  if (!message) {
    if (!state.sync.key) {
      message = "Sin clave de sincronizacion";
    } else if (state.sync.lastSyncedAt) {
      message = `Ultima sincronizacion: ${formatDateTime(state.sync.lastSyncedAt)}`;
      type = "ok";
    } else {
      message = "Pendiente de sincronizar";
    }
  }

  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("ok", type === "ok");
  els.syncStatus.classList.toggle("error", type === "error");
}

let syncTimer = null;
let syncInProgress = false;

function scheduleAutoSync(delay = 0) {
  window.clearTimeout(syncTimer);
  if (!state.sync.auto || !state.sync.key || !navigator.onLine) return;
  syncTimer = window.setTimeout(() => syncNow({ silent: true }), delay);
}

async function syncNow({ silent } = { silent: false }) {
  return runSync({ mode: "merge", silent });
}

async function replaceCloudFromThisDevice() {
  const confirmed = window.confirm(
    "Esto sustituira la nube por los datos de este dispositivo. Usalo solo en el dispositivo que tenga la version correcta.",
  );
  if (!confirmed) return;
  await runSync({ mode: "replace", silent: false });
}

async function pullCloudToThisDevice() {
  const confirmed = window.confirm(
    "Esto sustituira los datos de este dispositivo por la copia de la nube.",
  );
  if (!confirmed) return;
  await runSync({ mode: "pull", silent: false });
}

async function runSync({ mode, silent }) {
  state.sync.key = cleanText(els.syncKey.value || state.sync.key);
  state.sync.auto = els.syncAuto.checked;
  saveSyncSettings();

  if (!state.sync.key) {
    updateSyncStatus("Falta la clave de sincronizacion", "error");
    return;
  }

  if (!navigator.onLine) {
    updateSyncStatus("Sin conexion", "error");
    return;
  }

  if (syncInProgress) return;
  syncInProgress = true;
  if (!silent) {
    updateSyncStatus(
      syncProgressMessage(mode),
    );
  }
  els.syncNow.disabled = true;
  els.syncPull.disabled = true;
  els.syncReplace.disabled = true;

  try {
    const response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSyncPayload(mode)),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "No se pudo sincronizar");
    }

    applySyncedData(data);
    state.sync.lastSyncedAt = data.syncedAt || new Date().toISOString();
    saveSyncSettings();
    setSyncFormValues();
    buildTaskControls();
    resetForm();
    render();
    updateSyncStatus(
      mode === "replace"
        ? `Nube sustituida: ${state.entries.length} registros`
        : mode === "pull"
          ? `Nube descargada: ${state.entries.length} registros`
        : `Sincronizado: ${state.entries.length} registros`,
      "ok",
    );
  } catch (error) {
    updateSyncStatus(error.message || "No se pudo sincronizar", "error");
  } finally {
    syncInProgress = false;
    els.syncNow.disabled = false;
    els.syncPull.disabled = false;
    els.syncReplace.disabled = false;
  }
}

function syncProgressMessage(mode) {
  if (mode === "replace") return "Subiendo copia de este dispositivo...";
  if (mode === "pull") return "Descargando nube...";
  return "Sincronizando...";
}

function buildSyncPayload(mode = "merge") {
  return {
    syncKey: state.sync.key,
    mode,
    version: APP_VERSION,
    clientLastSyncedAt: state.sync.lastSyncedAt || "",
    entries: state.entries.map(normalizeEntry),
    deletedEntries: state.deletedEntries.map(normalizeTombstone),
    customTasks: state.customTasks,
    deletedTasks: state.deletedTasks,
  };
}

function applySyncedData(data) {
  const deletedIds = new Set((data.deletedEntries || []).map((item) => item.id));
  state.entries = repairLegacyMigrationEntries(data.entries || [])
    .filter((entry) => entry.id && !deletedIds.has(entry.id))
    .sort(compareEntries);
  state.deletedEntries = (data.deletedEntries || [])
    .map(normalizeTombstone)
    .filter((item) => item.id);
  state.customTasks = uniqueTasks(data.customTasks || []);
  state.deletedTasks = uniqueTasks(data.deletedTasks || []);
  persistAll();
}

function uniqueTasks(tasks) {
  return [
    ...new Set(
      tasks.map((task) => cleanText(task).toUpperCase()).filter(Boolean),
    ),
  ];
}

function startNewEntryFromButton() {
  const selectedTask = els.task.value || getTaskList()[0] || TASKS[0];
  resetForm();
  els.task.value = selectedTask;
  updateTaskButtonState();
  openEntryModal();
}

function openEntryModal() {
  els.entryPanel.classList.add("modal-open");
  document.body.classList.add("entry-modal-open");
}

function closeEntryModal() {
  els.entryPanel.classList.remove("modal-open");
  document.body.classList.remove("entry-modal-open");
}

function closeEntryModalOnMobile() {
  if (isMobileLayout()) closeEntryModal();
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function setInitialView() {
  const requested = new URLSearchParams(window.location.search).get("view");
  const allowedViews = new Set(["datos", "graficos", "configuracion"]);
  setView(allowedViews.has(requested) ? requested : "datos");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let shouldReloadOnControllerChange = Boolean(navigator.serviceWorker.controller);
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange || reloadingForUpdate) {
      shouldReloadOnControllerChange = true;
      return;
    }

    reloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
      );

      activateWaitingServiceWorker(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      await registration.update();
    } catch {
      // La app debe seguir funcionando aunque no se pueda comprobar la version.
    }
  });
}

function activateWaitingServiceWorker(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

async function checkForAppUpdate() {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;

    const latest = await response.json();
    if (!latest.version || latest.version === APP_VERSION) return;

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    window.location.reload();
  } catch {
    // Sin conexion o sin version remota: seguimos usando la app instalada.
  }
}

function saveCurrent(event) {
  event.preventDefault();
  const savedAt = new Date().toISOString();
  const previous = state.editingId
    ? state.entries.find((item) => item.id === state.editingId)
    : null;

  const entry = {
    id: state.editingId || createId(),
    date: els.date.value || todayISO(),
    task: els.task.value,
    description: els.description.value.trim(),
    notes: els.notes.value.trim(),
    start: els.start.value,
    end: els.end.value,
    createdAt: previous?.createdAt || savedAt,
    updatedAt: savedAt,
    syncVersion: APP_VERSION,
  };

  if (state.editingId) {
    state.entries = state.entries.map((item) =>
      item.id === state.editingId ? entry : item,
    );
  } else {
    state.entries.push(entry);
  }

  state.deletedEntries = state.deletedEntries.filter((item) => item.id !== entry.id);
  persist();
  persistDeletedEntries();
  resetForm();
  render();
  scheduleAutoSync(800);
  closeEntryModalOnMobile();
}

function deleteCurrent() {
  if (!state.editingId) return;
  const deletedAt = new Date().toISOString();
  const entry = state.entries.find((item) => item.id === state.editingId);
  state.entries = state.entries.filter((entry) => entry.id !== state.editingId);
  state.deletedEntries = upsertTombstone(state.deletedEntries, {
    id: state.editingId,
    task: entry?.task || "",
    deletedAt,
    updatedAt: deletedAt,
  });
  persist();
  persistDeletedEntries();
  resetForm();
  render();
  scheduleAutoSync(800);
  closeEntryModalOnMobile();
}

function editEntry(id, options = {}) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.editingId = id;
  els.date.value = entry.date || todayISO();
  els.task.value = entry.task || TASKS[0];
  els.description.value = entry.description || "";
  els.notes.value = entry.notes || "";
  els.start.value = entry.start || "";
  els.end.value = entry.end || "";
  els.save.textContent = "Actualizar";
  updateTaskButtonState();
  highlightEditingEntry();
  if (options.openModal) openEntryModal();
}

function resetForm() {
  state.editingId = null;
  els.form.reset();
  els.date.value = todayISO();
  els.task.value = getTaskList()[0] || TASKS[0];
  els.save.textContent = "Guardar";
  updateTaskButtonState();
  renderEntries();
}

function setTodayIfEmpty() {
  if (!els.date.value) els.date.value = todayISO();
  if (!els.task.value) els.task.value = getTaskList()[0] || TASKS[0];
  updateTaskButtonState();
}

function updateTaskButtonState() {
  document.querySelectorAll(".task-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.task === els.task.value);
  });
}

function updateDateFilterState() {
  const active = Boolean(state.dateFilter);
  els.clearDateFilter.hidden = !active;
  els.dateFilter.classList.toggle("active", active);
}

function render() {
  renderStats();
  renderEntries();
  renderCharts();
}

function renderStats() {
  const computed = computeRows();
  const stats = computeStats(computed);

  els.statAverage.textContent = minutesToDuration(stats.averageMinutes);
  els.statTotal.textContent = minutesToDuration(stats.totalMinutes);
  els.statDays.textContent = String(stats.spanDays);
  els.statEntries.textContent = String(state.entries.length);
  els.chartTotal.textContent = minutesToDuration(stats.totalMinutes);
}

function renderEntries() {
  const rows = sortRowsForDisplay(computeRows().filter(matchesSearch));

  els.body.innerHTML = rows
    .map(
      (row) => `<tr class="${row.id === state.editingId ? "selected" : ""}" data-id="${
        row.id
      }">
        <td>${formatDate(row.date)}</td>
        <td>${escapeHtml(row.task)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.notes)}</td>
        <td class="num">${escapeHtml(row.start)}</td>
        <td class="num">${escapeHtml(row.end)}</td>
        <td class="num">${row.partialMinutes ? minutesToDuration(row.partialMinutes) : ""}</td>
        <td class="num">${row.totalMinutes ? minutesToDuration(row.totalMinutes) : ""}</td>
        <td class="num">${row.dailyMinutes ? minutesToDuration(row.dailyMinutes) : ""}</td>
        <td class="num">${row.daysWork ?? ""}</td>
      </tr>`,
    )
    .join("");

  els.body.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => editEntry(row.dataset.id));
    row.addEventListener("dblclick", () =>
      editEntry(row.dataset.id, { openModal: true }),
    );
  });

  els.mobileList.innerHTML = rows
    .map(
      (row) => `<button class="entry-card ${
        row.id === state.editingId ? "selected" : ""
      }" type="button" data-id="${row.id}">
        <span class="entry-card-head">
          <strong>${formatDate(row.date)} - ${escapeHtml(row.task)}</strong>
          <small>${row.partialMinutes ? minutesToDuration(row.partialMinutes) : ""}</small>
        </span>
        <span>${escapeHtml(row.description || "-")}</span>
        <small>${escapeHtml(row.start || "--:--")} - ${escapeHtml(row.end || "--:--")}
          - Diario ${row.dailyMinutes ? minutesToDuration(row.dailyMinutes) : "-"}
          - Total ${row.totalMinutes ? minutesToDuration(row.totalMinutes) : "0:00"}</small>
      </button>`,
    )
    .join("");

  els.mobileList.querySelectorAll(".entry-card").forEach((card) => {
    card.addEventListener("click", () => editEntry(card.dataset.id));
    card.addEventListener("dblclick", () =>
      editEntry(card.dataset.id, { openModal: true }),
    );
  });
}

function highlightEditingEntry() {
  els.body.querySelectorAll("tr").forEach((row) => {
    row.classList.toggle("selected", row.dataset.id === state.editingId);
  });

  els.mobileList.querySelectorAll(".entry-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === state.editingId);
  });
}

function sortRowsForDisplay(rows) {
  const sorted = rows.slice().sort(compareEntries);
  const groups = new Map();
  sorted.forEach((row) => {
    const date = row.date || "";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(row);
  });

  const dates = [...groups.keys()].sort();
  if (state.sortOrder === "desc") dates.reverse();

  return dates.flatMap((date) => groups.get(date));
}

function renderCharts() {
  updateChartYearOptions();
  const rows = filterRowsByChartYear(computeRows());
  const byTask = groupMinutes(rows, (row) => row.task);
  const byMonth = groupMonths(rows);
  const taskRows = [...byTask.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter((item) => item[1] > 0);
  const monthRows = MONTHS.map((label, index) => [label, byMonth.get(index) || 0]);
  const total = taskRows.reduce((sum, item) => sum + item[1], 0);

  els.chartTotal.textContent = minutesToDuration(total);
  els.chartTopTask.textContent = taskRows[0]?.[0] || "-";
  els.chartTopMonth.textContent =
    monthRows.slice().sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  els.taskSummary.innerHTML = summaryMarkup(
    "TAREAS",
    "Total horas",
    taskRows,
    total,
  );
  els.monthSummary.innerHTML = summaryMarkup(
    "MESES",
    "Suma de PARCIAL",
    monthRows,
    monthRows.reduce((sum, item) => sum + item[1], 0),
  );

  const maxTask = Math.max(...taskRows.map((item) => item[1]), 1);
  els.taskChart.innerHTML = taskRows
    .map(
      ([label, minutes]) => `<div class="bar-line">
        <span class="bar-label">${escapeHtml(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(
          2,
          (minutes / maxTask) * 100,
        )}%"></span></span>
        <strong class="bar-value">${minutesToDuration(minutes)}</strong>
      </div>`,
    )
    .join("");

  const maxMonth = Math.max(...monthRows.map((item) => item[1]), 1);
  els.monthChart.innerHTML = monthRows
    .map(
      ([label, minutes]) => `<div class="month-bar">
        <span class="month-bar-fill" style="height:${Math.max(
          2,
          (minutes / maxMonth) * 100,
        )}%"></span>
        <strong>${minutes ? minutesToDuration(minutes) : ""}</strong>
        <span>${label}</span>
      </div>`,
    )
    .join("");
}

function updateChartYearOptions() {
  const years = getDataYears();
  const options = [
    `<option value="${ALL_YEARS_VALUE}">Todos</option>`,
    ...years.map((year) => `<option value="${year}">${year}</option>`),
  ];

  els.chartYearFilter.innerHTML = options.join("");
  els.chartYearFilter.value = state.chartYear;
  if (!els.chartYearFilter.value) {
    state.chartYear = currentYear();
    els.chartYearFilter.value = state.chartYear;
  }
}

function getDataYears() {
  const years = state.entries
    .map((entry) => String(entry.date || "").slice(0, 4))
    .filter((year) => /^\d{4}$/.test(year));
  return [...new Set([...years, currentYear()])].sort((a, b) =>
    b.localeCompare(a),
  );
}

function filterRowsByChartYear(rows) {
  if (state.chartYear === ALL_YEARS_VALUE) return rows;
  return rows.filter((row) => String(row.date || "").startsWith(state.chartYear));
}

function summaryMarkup(labelHead, valueHead, rows, totalMinutes) {
  const body = rows
    .filter((row) => row[1] > 0)
    .map(
      ([label, minutes]) => `<div class="summary-row">
        <span>${escapeHtml(label)}</span>
        <strong>${minutesToDuration(minutes)}</strong>
      </div>`,
    )
    .join("");

  return `<div class="summary-row header">
      <span>${escapeHtml(labelHead)}</span>
      <strong>${escapeHtml(valueHead)}</strong>
    </div>
    ${body || `<div class="summary-row"><span>Sin datos</span><strong>0:00</strong></div>`}
    <div class="summary-row total">
      <span>Total general</span>
      <strong>${minutesToDuration(totalMinutes)}</strong>
    </div>`;
}

function computeRows() {
  const rows = state.entries
    .map((entry) => ({
      ...entry,
      partialMinutes: computePartial(entry.start, entry.end),
    }))
    .sort(compareEntries);

  let totalMinutes = 0;
  const dailyTotals = new Map();
  const lastIndexByDate = new Map();
  const firstDate = rows[0]?.date;

  rows.forEach((row, index) => {
    totalMinutes += row.partialMinutes;
    row.totalMinutes = totalMinutes;
    dailyTotals.set(row.date, (dailyTotals.get(row.date) || 0) + row.partialMinutes);
    lastIndexByDate.set(row.date, index);
  });

  rows.forEach((row, index) => {
    if (lastIndexByDate.get(row.date) === index) {
      row.dailyMinutes = dailyTotals.get(row.date) || 0;
      row.daysWork = firstDate ? dateDiffDays(firstDate, row.date) + 1 : 0;
    } else {
      row.dailyMinutes = 0;
      row.daysWork = null;
    }
  });

  return rows;
}

function computeStats(rows) {
  const totalMinutes = rows.reduce((sum, row) => sum + row.partialMinutes, 0);
  const datedRows = rows.filter((row) => row.date);
  const first = datedRows[0]?.date;
  const last = datedRows[datedRows.length - 1]?.date;
  const spanDays = first && last ? Math.max(1, dateDiffDays(first, last) + 1) : 0;
  return {
    totalMinutes,
    spanDays,
    averageMinutes: spanDays ? Math.round(totalMinutes / spanDays) : 0,
  };
}

function matchesSearch(row) {
  if (state.dateFilter && row.date !== state.dateFilter) return false;
  if (!state.search) return true;
  return [
    row.date,
    row.task,
    row.description,
    row.notes,
    row.start,
    row.end,
  ]
    .join(" ")
    .toLowerCase()
    .includes(state.search);
}

function groupMinutes(rows, getter) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getter(row);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + row.partialMinutes);
  });
  return map;
}

function groupMonths(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row.date) return;
    const month = Number(row.date.slice(5, 7)) - 1;
    map.set(month, (map.get(month) || 0) + row.partialMinutes);
  });
  return map;
}

function compareEntries(a, b) {
  return `${a.date || ""} ${a.start || ""} ${a.id}`.localeCompare(
    `${b.date || ""} ${b.start || ""} ${b.id}`,
  );
}

function computePartial(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes == null || endMinutes == null) return 0;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function timeToMinutes(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = String(safe % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function dateDiffDays(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function todayISO() {
  const date = new Date();
  return toISODate(date);
}

function formatDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDate(toISODate(date))} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function currentYear() {
  return String(new Date().getFullYear());
}

function nowTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEntry(entry, fallbackDate = new Date().toISOString()) {
  const updatedAt = entry.updatedAt || entry.createdAt || fallbackDate;
  return {
    id: entry.id || createId(),
    date: parseDate(entry.date || entry.FECHA || entry.Fecha),
    task: cleanText(entry.task || entry.TAREA || entry.Tarea).toUpperCase(),
    description: cleanText(
      entry.description || entry.DESCRIPCION || entry.Descripcion,
    ),
    notes: cleanText(entry.notes || entry.Notas || entry.NOTAS),
    start: parseTime(entry.start || entry["TIEMPO INICIO"] || entry.inicio),
    end: parseTime(entry.end || entry["TIEMPO FINAL"] || entry.final),
    createdAt: entry.createdAt || updatedAt,
    updatedAt,
    syncVersion: cleanText(entry.syncVersion),
  };
}

function normalizeTombstone(item, fallbackDate = new Date().toISOString()) {
  const updatedAt = item.updatedAt || item.deletedAt || fallbackDate;
  return {
    id: item.id || "",
    task: cleanText(item.task).toUpperCase(),
    deletedAt: item.deletedAt || updatedAt,
    updatedAt,
  };
}

function upsertTombstone(list, tombstone) {
  const normalized = normalizeTombstone(tombstone);
  return [
    normalized,
    ...list.filter((item) => item.id !== normalized.id),
  ];
}

function repairLegacyMigrationEntries(entries) {
  const normalized = entries.map((entry) => normalizeEntry(entry));
  const bulkStamps = new Map();

  normalized.forEach((entry) => {
    if (!isBulkMigrationCandidate(entry)) return;
    bulkStamps.set(entry.updatedAt, (bulkStamps.get(entry.updatedAt) || 0) + 1);
  });

  return normalized.map((entry) => {
    if (
      isBulkMigrationCandidate(entry) &&
      (bulkStamps.get(entry.updatedAt) || 0) >= BULK_MIGRATION_LIMIT
    ) {
      return {
        ...entry,
        createdAt: LEGACY_UPDATED_AT,
        updatedAt: LEGACY_UPDATED_AT,
        syncVersion: APP_VERSION,
      };
    }
    return { ...entry, syncVersion: entry.syncVersion || APP_VERSION };
  });
}

function isBulkMigrationCandidate(entry) {
  return (
    !entry.syncVersion &&
    Boolean(entry.createdAt) &&
    entry.createdAt === entry.updatedAt
  );
}

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const entries = repairLegacyMigrationEntries(JSON.parse(saved))
        .filter((entry) => entry.date && entry.task);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return entries;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return repairLegacyMigrationEntries(SAMPLE_ENTRIES);
}

function loadCustomTasks() {
  try {
    const saved = localStorage.getItem(CUSTOM_TASKS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(CUSTOM_TASKS_KEY);
  }
  return [];
}

function loadDeletedTasks() {
  try {
    const saved = localStorage.getItem(DELETED_TASKS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(DELETED_TASKS_KEY);
  }
  return [];
}

function loadDeletedEntries() {
  try {
    const saved = localStorage.getItem(DELETED_ENTRIES_KEY);
    if (saved) return JSON.parse(saved).map(normalizeTombstone);
  } catch {
    localStorage.removeItem(DELETED_ENTRIES_KEY);
  }
  return [];
}

function loadSyncSettings() {
  try {
    const saved = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        key: cleanText(settings.key),
        auto: Boolean(settings.auto),
        lastSyncedAt: cleanText(settings.lastSyncedAt),
      };
    }
  } catch {
    localStorage.removeItem(SYNC_SETTINGS_KEY);
  }
  return { key: "", auto: false, lastSyncedAt: "" };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function persistCustomTasks() {
  localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(state.customTasks));
}

function persistDeletedTasks() {
  localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(state.deletedTasks));
}

function persistDeletedEntries() {
  localStorage.setItem(DELETED_ENTRIES_KEY, JSON.stringify(state.deletedEntries));
}

function saveSyncSettings() {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(state.sync));
}

function persistAll() {
  persist();
  persistCustomTasks();
  persistDeletedTasks();
  persistDeletedEntries();
}

async function handleFileLoad() {
  const file = els.fileInput.files?.[0];
  if (!file) return;

  try {
    const extension = file.name.toLowerCase().split(".").pop();
    let entries;
    let backupData = null;
    if (extension === "json") {
      backupData = JSON.parse(await file.text());
      entries = normalizeImportedEntries(backupData);
    } else if (extension === "csv") {
      entries = rowsToEntries(parseCsv(await file.text()));
    } else if (extension === "xlsx" || extension === "xls") {
      entries = await importXlsx(file);
    } else {
      throw new Error("Formato no soportado");
    }

    if (!entries.length) throw new Error("No se han encontrado registros");
    state.entries = entries;
    state.deletedEntries = Array.isArray(backupData?.deletedEntries)
      ? backupData.deletedEntries.map(normalizeTombstone)
      : [];
    if (Array.isArray(backupData?.customTasks)) {
      state.customTasks = uniqueTasks(backupData.customTasks);
      persistCustomTasks();
    }
    if (Array.isArray(backupData?.deletedTasks)) {
      state.deletedTasks = uniqueTasks(backupData.deletedTasks);
      persistDeletedTasks();
    }
    persist();
    persistDeletedEntries();
    buildTaskControls();
    resetForm();
    render();
  } catch (error) {
    alert(error.message || "No se pudo cargar el archivo");
  } finally {
    els.fileInput.value = "";
  }
}

async function importXlsx(file) {
  if (!window.XLSX) {
    throw new Error("El lector Excel no esta disponible todavia");
  }
  const data = await file.arrayBuffer();
  const workbook = window.XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.includes("Datos")
    ? "Datos"
    : workbook.SheetNames[0];
  const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: "",
  });
  return rowsToEntries(rows);
}

function rowsToEntries(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const index = {
    date: findHeader(headers, ["fecha"]),
    task: findHeader(headers, ["tarea"]),
    description: findHeader(headers, ["descripcion", "descripcion"]),
    notes: findHeader(headers, ["notas"]),
    start: findHeader(headers, ["tiempo inicio", "inicio"]),
    end: findHeader(headers, ["tiempo final", "final"]),
  };

  return rows
    .slice(1)
    .map((row) =>
      normalizeEntry({
        id: createId(),
        date: row[index.date],
        task: row[index.task],
        description: row[index.description],
        notes: row[index.notes],
        start: row[index.start],
        end: row[index.end],
      }),
    )
    .filter((entry) => entry.date && entry.task);
}

function normalizeImportedEntries(input) {
  const list = Array.isArray(input) ? input : input.entries;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => normalizeEntry(item))
    .filter((entry) => entry.date && entry.task);
}

function normalizeHeader(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findHeader(headers, names) {
  return headers.findIndex((header) => names.includes(header));
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODate(value);
  }
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
    return toISODate(date);
  }
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : toISODate(parsed);
}

function parseTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(
      value.getMinutes(),
    ).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const total = Math.round((value % 1) * 24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
      total % 60,
    ).padStart(2, "0")}`;
  }
  const text = cleanText(value);
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match
    ? `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`
    : "";
}

function cleanText(value) {
  return value == null ? "" : String(value).trim();
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ";"
      : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => cleanText(item)));
}

function exportCsv() {
  const headers = [
    "FECHA",
    "TAREA",
    "DESCRIPCION",
    "Notas",
    "TIEMPO INICIO",
    "TIEMPO FINAL",
  ];
  const rows = state.entries
    .slice()
    .sort(compareEntries)
    .map((entry) =>
      [
        formatDate(entry.date),
        entry.task,
        entry.description,
        entry.notes,
        entry.start,
        entry.end,
      ].map(csvCell),
    );
  downloadText(
    "tiempos.csv",
    `\uFEFF${[headers.map(csvCell), ...rows].map((row) => row.join(",")).join("\n")}`,
    "text/csv;charset=utf-8",
  );
}

function exportJson() {
  downloadText(
    "tiempos-backup.json",
    JSON.stringify(
      {
        entries: state.entries,
        deletedEntries: state.deletedEntries,
        customTasks: state.customTasks,
        deletedTasks: state.deletedTasks,
      },
      null,
      2,
    ),
    "application/json",
  );
}

function csvCell(value) {
  return `"${cleanText(value).replace(/"/g, '""')}"`;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
