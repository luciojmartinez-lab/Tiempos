const STORAGE_KEY = "tiempos.entries.100v1";
const CUSTOM_TASKS_KEY = "tiempos.customTasks.100v2";
const DELETED_TASKS_KEY = "tiempos.deletedTasks.100v3";
const DELETED_ENTRIES_KEY = "tiempos.deletedEntries.100v11";
const SYNC_SETTINGS_KEY = "tiempos.syncSettings.100v11";
const TRACKING_SETTINGS_KEY = "tiempos.trackingSettings.100v24";
const ENTRY_DRAFT_KEY = "tiempos.entryDraft.100v25";
const APP_VERSION = "100v29";
const TRACKING_ACTION_LOCK_MS = 850;
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
  tracking: loadTrackingSettings(),
  editingId: null,
  search: "",
  dateFilter: "",
  yearFilter: "",
  monthFilter: "",
  sortOrder: "desc",
  chartYear: currentYear(),
};

const els = {};
const trackingActionLocks = new Map();

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindElements();
  buildTaskControls();
  bindEvents();
  setSyncFormValues();
  setTrackingFormValues();
  setTodayIfEmpty();
  restoreSavedEntryDraft();
  updateDateFilterState();
  updateSyncStatus();
  render();
  setInitialView();
  startLiveUpdates();
  startAutoSyncHeartbeat();
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
    toggleSyncKey: document.getElementById("toggle-sync-key"),
    saveSyncKey: document.getElementById("save-sync-key"),
    syncNow: document.getElementById("sync-now"),
    syncCheck: document.getElementById("sync-check"),
    syncPull: document.getElementById("sync-pull"),
    syncReplace: document.getElementById("sync-replace"),
    syncAuto: document.getElementById("sync-auto"),
    syncStatus: document.getElementById("sync-status"),
    allowSimultaneous: document.getElementById("allow-simultaneous"),
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
    endDate: document.getElementById("entry-end-date"),
    segmentsEditor: document.getElementById("segments-editor"),
    segmentsList: document.getElementById("segments-list"),
    segmentsError: document.getElementById("segments-error"),
    addSegment: document.getElementById("add-segment"),
    timeNowButtons: document.querySelectorAll("[data-time-now]"),
    timePickerButtons: document.querySelectorAll("[data-time-picker]"),
    startTracking: document.getElementById("start-tracking"),
    save: document.getElementById("save-entry"),
    clear: document.getElementById("clear-form"),
    remove: document.getElementById("delete-entry"),
    loadFile: document.getElementById("load-file"),
    fileInput: document.getElementById("file-input"),
    exportCsv: document.getElementById("export-csv"),
    exportJson: document.getElementById("export-json"),
    search: document.getElementById("search-box"),
    dateFilter: document.getElementById("date-filter"),
    yearFilter: document.getElementById("year-filter"),
    monthFilter: document.getElementById("month-filter"),
    clearDateFilter: document.getElementById("clear-date-filter"),
    sortOrder: document.getElementById("sort-order"),
    body: document.getElementById("entries-body"),
    mobileList: document.getElementById("mobile-list"),
    statAverage: document.getElementById("stat-average"),
    statTotal: document.getElementById("stat-total"),
    statDays: document.getElementById("stat-days"),
    statEntries: document.getElementById("stat-entries"),
    trackingSummary: document.getElementById("tracking-summary"),
    runningTasks: document.getElementById("running-tasks"),
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
    persistEntryDraft();
  });

  els.task.addEventListener("change", updateTaskButtonState);
  els.addTask.addEventListener("click", addTaskFromInput);
  els.deleteTask.addEventListener("click", deleteSelectedTask);
  els.toggleSyncKey.addEventListener("click", toggleSyncKeyVisibility);
  els.saveSyncKey.addEventListener("click", saveSyncSettingsFromForm);
  els.syncNow.addEventListener("click", () => syncNow({ silent: false }));
  els.syncCheck.addEventListener("click", checkCloudStatus);
  els.syncPull.addEventListener("click", pullCloudToThisDevice);
  els.syncReplace.addEventListener("click", replaceCloudFromThisDevice);
  els.syncAuto.addEventListener("change", () => {
    state.sync.auto = els.syncAuto.checked;
    saveSyncSettings();
    updateSyncStatus();
    scheduleAutoSync(800);
  });
  els.allowSimultaneous.addEventListener("change", updateTrackingSettings);
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
  els.startTracking.addEventListener("click", startTrackingFromForm);
  els.form.addEventListener("submit", saveCurrent);
  els.form.addEventListener("input", persistEntryDraft);
  els.form.addEventListener("change", persistEntryDraft);
  [els.date, els.start, els.endDate, els.end].forEach((field) => {
    field.addEventListener("change", syncMainDatesToSegmentEditor);
  });
  els.date.addEventListener("change", () => {
    if (!state.editingId && !els.segmentsList.children.length) {
      els.endDate.value = els.date.value;
    }
  });
  els.segmentsList.addEventListener("change", syncMainDatesFromSegmentEditor);
  els.segmentsList.addEventListener("input", () => {
    els.segmentsError.textContent = "";
  });
  els.addSegment.addEventListener("click", addSegmentToEditor);
  els.segmentsList.addEventListener("click", removeNewSegmentFromEditor);
  els.runningTasks.addEventListener("click", handleTrackingAction);
  els.timeNowButtons.forEach((button) => {
    button.addEventListener("click", () => setTimeToNow(button.dataset.timeNow));
  });
  els.timePickerButtons.forEach((button) => {
    button.addEventListener("click", () => openTimePicker(button.dataset.timePicker));
  });
  els.search.addEventListener("input", () => {
    state.search = els.search.value.trim().toLowerCase();
    renderFilteredData();
  });
  els.dateFilter.addEventListener("change", () => {
    state.dateFilter = els.dateFilter.value;
    if (state.dateFilter) {
      state.yearFilter = "";
      state.monthFilter = "";
      els.yearFilter.value = "";
      els.monthFilter.value = "";
    }
    updateDateFilterState();
    renderFilteredData();
  });
  els.yearFilter.addEventListener("change", () => {
    state.yearFilter = els.yearFilter.value;
    if (state.yearFilter) {
      state.dateFilter = "";
      els.dateFilter.value = "";
    }
    updateDateFilterState();
    renderFilteredData();
  });
  els.monthFilter.addEventListener("change", () => {
    state.monthFilter = els.monthFilter.value;
    if (state.monthFilter) {
      state.dateFilter = "";
      els.dateFilter.value = "";
    }
    updateDateFilterState();
    renderFilteredData();
  });
  els.clearDateFilter.addEventListener("click", () => {
    state.dateFilter = "";
    state.yearFilter = "";
    state.monthFilter = "";
    els.dateFilter.value = "";
    els.yearFilter.value = "";
    els.monthFilter.value = "";
    updateDateFilterState();
    renderFilteredData();
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
    if (document.hidden) {
      persistBeforeSuspension();
    } else {
      render();
      scheduleAutoSync(500);
    }
  });
  document.addEventListener("freeze", persistBeforeSuspension);
  window.addEventListener("pagehide", persistBeforeSuspension);
  window.addEventListener("beforeunload", persistBeforeSuspension);
  window.addEventListener("pageshow", () => {
    render();
    scheduleAutoSync(500);
  });
}

function persistBeforeSuspension() {
  try {
    persist();
    persistDeletedEntries();
    persistTrackingSettings();
    persistEntryDraft();
  } catch {
    // El sistema puede estar cerrando la pagina; el ultimo guardado sigue valido.
  }
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

function setTrackingFormValues() {
  els.allowSimultaneous.checked = Boolean(state.tracking.allowSimultaneous);
}

function updateTrackingSettings() {
  state.tracking.allowSimultaneous = els.allowSimultaneous.checked;
  state.tracking.updatedAt = new Date().toISOString();

  if (!state.tracking.allowSimultaneous) {
    const active = getTrackedEntries("active").sort((a, b) =>
      compareDate(b.statusUpdatedAt || b.updatedAt, a.statusUpdatedAt || a.updatedAt),
    );
    pauseOtherActiveEntries(new Date(), active[0]?.id || "");
  }

  persistTrackingSettings();
  persist();
  render();
  scheduleAutoSync(500);
}

function saveSyncSettingsFromForm() {
  state.sync.key = cleanText(els.syncKey.value);
  els.syncKey.value = state.sync.key;
  state.sync.auto = els.syncAuto.checked;
  saveSyncSettings();
  updateSyncStatus("Configuracion guardada", "ok");
  scheduleAutoSync(500);
}

function toggleSyncKeyVisibility() {
  const isVisible = els.syncKey.type === "text";
  els.syncKey.type = isVisible ? "password" : "text";
  els.toggleSyncKey.classList.toggle("active", !isVisible);
  els.toggleSyncKey.setAttribute(
    "aria-label",
    isVisible ? "Mostrar clave" : "Ocultar clave",
  );
  els.toggleSyncKey.title = isVisible ? "Mostrar clave" : "Ocultar clave";
  els.syncKey.focus();
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
let liveTimer = null;
let syncHeartbeat = null;
let lastLiveMinute = -1;

function scheduleAutoSync(delay = 0) {
  window.clearTimeout(syncTimer);
  if (!state.sync.auto || !state.sync.key || !navigator.onLine) return;
  syncTimer = window.setTimeout(() => syncNow({ silent: true }), delay);
}

function startAutoSyncHeartbeat() {
  window.clearInterval(syncHeartbeat);
  syncHeartbeat = window.setInterval(() => {
    if (!document.hidden) scheduleAutoSync(0);
  }, 30000);
}

function startLiveUpdates() {
  window.clearInterval(liveTimer);
  liveTimer = window.setInterval(() => {
    renderRunningTasks();
    const minute = new Date().getMinutes();
    if (minute !== lastLiveMinute && getTrackedEntries("active").length) {
      lastLiveMinute = minute;
      renderStats();
      renderEntries();
      renderCharts();
    }
  }, 1000);
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

async function checkCloudStatus() {
  await runSync({ mode: "status", silent: false });
}

async function runSync({ mode, silent }) {
  state.sync.key = cleanText(els.syncKey.value || state.sync.key);
  els.syncKey.value = state.sync.key;
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
  els.syncCheck.disabled = true;
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

    if (mode === "status") {
      updateSyncStatus(cloudSummaryMessage(data), "ok");
      return;
    }

    const entryDraft = captureEntryDraft();
    saveEntryDraft(entryDraft);
    applySyncedData(data);
    state.sync.lastSyncedAt = data.syncedAt || new Date().toISOString();
    saveSyncSettings();
    setSyncFormValues();
    setTrackingFormValues();
    buildTaskControls();
    restoreEntryDraft(entryDraft);
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
    els.syncCheck.disabled = false;
    els.syncPull.disabled = false;
    els.syncReplace.disabled = false;
  }
}

function syncProgressMessage(mode) {
  if (mode === "replace") return "Subiendo copia de este dispositivo...";
  if (mode === "pull") return "Descargando nube...";
  if (mode === "status") return "Comprobando nube...";
  return "Sincronizando...";
}

function cloudSummaryMessage(data) {
  const summary = data.cloudSummary || {};
  const rows = Array.isArray(summary.latestRows) ? summary.latestRows : [];
  const latest = rows
    .slice(0, 2)
    .map(
      (row) =>
        `${formatDate(row.date)} ${row.task || ""} ${row.start || "--"}-${row.end || "--"}`,
    )
    .join(" | ");
  return `ID nube ${data.keyId || "-"} - Nube ${
    summary.entriesCount ?? 0
  } registros${latest ? ` - ${latest}` : ""}`;
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
    trackingSettings: state.tracking,
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
  state.tracking = normalizeTrackingSettings(
    data.trackingSettings || state.tracking,
  );
  const adjustedTracking = enforceSingleActiveTask();
  persistAll();
  if (adjustedTracking) scheduleAutoSync(1000);
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
  persistEntryDraft();
}

function closeEntryModal() {
  els.entryPanel.classList.remove("modal-open");
  document.body.classList.remove("entry-modal-open");
  persistEntryDraft();
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
    persistBeforeSuspension();
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
  const hasNewSegment = Boolean(
    previous && els.segmentsList.querySelector(".segment-row.is-new"),
  );
  const tracked = Boolean(previous?.tracked || hasNewSegment);

  const entry = tracked
    ? buildTrackedEntryFromForm(previous, savedAt)
    : buildManualEntryFromForm(previous, savedAt);
  if (!entry) return;

  if (
    entry.tracked &&
    entry.status === "active" &&
    previous?.status !== "active" &&
    !state.tracking.allowSimultaneous
  ) {
    pauseOtherActiveEntries(new Date(), entry.id);
  }

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

function buildManualEntryFromForm(previous, savedAt) {
  const startDate = els.date.value || todayISO();
  const endDate = els.endDate.value || startDate;
  const startTime = els.start.value;
  const endTime = els.end.value;

  if ((startTime && !endTime) || (!startTime && endTime)) {
    alert("Indica tanto la hora de inicio como la hora final.");
    return null;
  }

  if (startTime && endTime) {
    const startAt = localDateTime(startDate, startTime);
    const endAt = localDateTime(endDate, endTime);
    if (!startAt || !endAt || endAt < startAt) {
      alert("La fecha y hora final no pueden ser anteriores al inicio.");
      return null;
    }
  }

  return normalizeEntry({
    id: state.editingId || createId(),
    date: startDate,
    startDate,
    endDate: endTime ? endDate : "",
    task: els.task.value,
    description: els.description.value.trim(),
    notes: els.notes.value.trim(),
    start: startTime,
    end: endTime,
    createdAt: previous?.createdAt || savedAt,
    updatedAt: savedAt,
    syncVersion: APP_VERSION,
    tracked: false,
    status: "completed",
    statusUpdatedAt: savedAt,
    segments: [],
  });
}

function buildTrackedEntryFromForm(previous, savedAt) {
  syncMainDatesToSegmentEditor();
  const allowOpenLast =
    previous.status === "active" ||
    Boolean(els.segmentsList.querySelector(".segment-row.is-new"));
  const result = readEditedSegments(
    savedAt,
    previous.status,
    previous.segments,
    allowOpenLast,
  );
  if (!result) return null;
  const segments = result.segments;
  const firstStart = new Date(segments[0].startAt);
  const lastEndAt = segments.at(-1).endAt;
  const lastEnd = lastEndAt ? new Date(lastEndAt) : null;
  const status = result.hasOpenSegment
    ? "active"
    : previous.status === "active"
      ? "completed"
      : previous.status;
  const temporalShape = (items) => items.map(({ id, startAt, endAt }) => ({
    id,
    startAt,
    endAt,
  }));
  const temporalChanged = JSON.stringify(temporalShape(segments)) !== JSON.stringify(
    temporalShape(normalizeSegments(previous.segments)),
  );

  return normalizeEntry({
    ...previous,
    task: els.task.value,
    description: els.description.value.trim(),
    notes: els.notes.value.trim(),
    date: toISODate(firstStart),
    startDate: toISODate(firstStart),
    endDate: lastEnd ? toISODate(lastEnd) : "",
    start: formatTimeFromDate(firstStart),
    end: status === "active" ? "" : lastEnd ? formatTimeFromDate(lastEnd) : "",
    status,
    statusUpdatedAt: temporalChanged ? savedAt : previous.statusUpdatedAt,
    updatedAt: savedAt,
    syncVersion: APP_VERSION,
    segments,
  });
}

function readEditedSegments(
  savedAt,
  status,
  previousSegments = [],
  allowOpenLast = status === "active",
) {
  const rows = [...els.segmentsList.querySelectorAll(".segment-row")];
  if (!rows.length) return null;

  const previousById = new Map(
    normalizeSegments(previousSegments).map((segment) => [segment.id, segment]),
  );
  const segments = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const startDate = row.querySelector('[data-segment-field="start-date"]').value;
    const startTime = row.querySelector('[data-segment-field="start-time"]').value;
    const endDate = row.querySelector('[data-segment-field="end-date"]').value;
    const endTime = row.querySelector('[data-segment-field="end-time"]').value;
    const startAt = localDateTime(startDate, startTime);
    const hasAnyEnd = Boolean(endDate || endTime);
    const hasCompleteEnd = Boolean(endDate && endTime);
    const endAt = hasCompleteEnd ? localDateTime(endDate, endTime) : null;

    if (!startAt) return showSegmentsError(`Completa el inicio del tramo ${index + 1}.`);
    if (hasAnyEnd && !hasCompleteEnd) {
      return showSegmentsError(`Completa la fecha y la hora final del tramo ${index + 1}.`);
    }
    if (!hasAnyEnd && (!allowOpenLast || index !== rows.length - 1)) {
      return showSegmentsError(`El tramo ${index + 1} necesita fecha y hora final.`);
    }
    if (endAt && endAt < startAt) {
      return showSegmentsError(`El final del tramo ${index + 1} es anterior a su inicio.`);
    }

    const id = row.dataset.segmentId || createId();
    const startAtIso = startAt.toISOString();
    const endAtIso = endAt ? endAt.toISOString() : "";
    const previous = previousById.get(id);
    segments.push({
      id,
      startAt: startAtIso,
      endAt: endAtIso,
      updatedAt:
        previous?.startAt === startAtIso && previous?.endAt === endAtIso
          ? previous.updatedAt
          : savedAt,
    });
  }

  segments.sort((a, b) => compareDate(a.startAt, b.startAt));
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    if (!previous.endAt || compareDate(segments[index].startAt, previous.endAt) < 0) {
      return showSegmentsError("Los tramos no pueden solaparse ni quedar abiertos entre medias.");
    }
  }

  els.segmentsError.textContent = "";
  return {
    segments,
    hasOpenSegment: segments.some((segment) => !segment.endAt),
  };
}

function showSegmentsError(message) {
  els.segmentsError.textContent = message;
  els.segmentsError.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return null;
}

function localDateTime(dateValue, timeValue) {
  const dateMatch = cleanText(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = cleanText(timeValue).match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;
  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderSegmentEditor(entry, draftSegments = null) {
  const storedSegments = normalizeSegments(entry?.segments);
  const segments = draftSegments || (
    storedSegments.length ? storedSegments : manualEntryToSegmentDraft(entry)
  );
  const visible = Boolean(entry);
  els.segmentsEditor.hidden = !visible;
  els.segmentsError.textContent = "";
  if (!visible) {
    els.segmentsList.innerHTML = "";
    return;
  }

  els.segmentsList.innerHTML = segments
    .map((segment, index) => {
      const values = Object.hasOwn(segment, "startDate")
        ? segment
        : segmentToFormValues(segment);
      const isNew = Boolean(values.isNew);
      return `<div class="segment-row${isNew ? " is-new" : ""}" data-segment-id="${escapeAttr(segment.id)}">
        <span class="segment-number">Tramo ${index + 1}</span>
        <label><span>Fecha inicio</span><input type="date" data-segment-field="start-date" value="${escapeAttr(values.startDate)}" required></label>
        <label><span>Hora inicio</span><input type="time" data-segment-field="start-time" value="${escapeAttr(values.startTime)}" required></label>
        <label><span>Fecha final</span><input type="date" data-segment-field="end-date" value="${escapeAttr(values.endDate)}"></label>
        <label><span>Hora final</span><input type="time" data-segment-field="end-time" value="${escapeAttr(values.endTime)}"></label>
        ${isNew ? '<button class="ghost remove-new-segment" type="button" data-remove-new-segment>Quitar tramo nuevo</button>' : ""}
      </div>`;
    })
    .join("");
}

function manualEntryToSegmentDraft(entry) {
  if (!entry || !entry.start || !entry.end) return [];
  const startDate = entry.startDate || entry.date;
  const endDate = entry.endDate || startDate;
  const startAt = localDateTime(startDate, entry.start);
  const endAt = localDateTime(endDate, entry.end);
  if (!startAt || !endAt || endAt < startAt) return [];
  return [{
    id: `manual-${entry.id}`,
    isNew: false,
    startDate,
    startTime: entry.start,
    endDate,
    endTime: entry.end,
  }];
}

function segmentToFormValues(segment) {
  const start = new Date(segment.startAt);
  const end = segment.endAt ? new Date(segment.endAt) : null;
  return {
    id: segment.id,
    startDate: toISODate(start),
    startTime: formatTimeFromDate(start),
    endDate: end ? toISODate(end) : "",
    endTime: end ? formatTimeFromDate(end) : "",
  };
}

function captureSegmentDraft() {
  return [...els.segmentsList.querySelectorAll(".segment-row")].map((row) => ({
    id: row.dataset.segmentId,
    isNew: row.classList.contains("is-new"),
    startDate: row.querySelector('[data-segment-field="start-date"]').value,
    startTime: row.querySelector('[data-segment-field="start-time"]').value,
    endDate: row.querySelector('[data-segment-field="end-date"]').value,
    endTime: row.querySelector('[data-segment-field="end-time"]').value,
  }));
}

function addSegmentToEditor() {
  const entry = state.entries.find((item) => item.id === state.editingId);
  if (!entry) return;
  if (entry.status === "active") {
    alert("Pausa la ocupacion antes de añadir un tramo manual.");
    return;
  }

  const now = new Date();
  const date = toISODate(now);
  const time = formatTimeFromDate(now);
  const draft = captureSegmentDraft();
  draft.push({
    id: createId(),
    isNew: true,
    startDate: date,
    startTime: time,
    endDate: "",
    endTime: "",
  });
  renderSegmentEditor(entry, draft);
  syncMainDatesFromSegmentRows();
  persistEntryDraft();
  els.segmentsList.querySelector(".segment-row:last-child")?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function removeNewSegmentFromEditor(event) {
  const button = event.target.closest("[data-remove-new-segment]");
  if (!button) return;
  button.closest(".segment-row")?.remove();
  renumberSegmentRows();
  syncMainDatesFromSegmentRows();
  persistEntryDraft();
}

function renumberSegmentRows() {
  [...els.segmentsList.querySelectorAll(".segment-number")].forEach(
    (label, index) => {
      label.textContent = `Tramo ${index + 1}`;
    },
  );
}

function syncMainDatesFromSegmentRows() {
  const rows = [...els.segmentsList.querySelectorAll(".segment-row")];
  if (!rows.length) return;
  const first = rows[0];
  const last = rows.at(-1);
  els.date.value = first.querySelector('[data-segment-field="start-date"]').value;
  els.start.value = first.querySelector('[data-segment-field="start-time"]').value;
  els.endDate.value = last.querySelector('[data-segment-field="end-date"]').value;
  els.end.value = last.querySelector('[data-segment-field="end-time"]').value;
  els.segmentsError.textContent = "";
}

function syncMainDatesToSegmentEditor() {
  const rows = [...els.segmentsList.querySelectorAll(".segment-row")];
  if (!rows.length) return;
  const first = rows[0];
  const last = rows.at(-1);
  first.querySelector('[data-segment-field="start-date"]').value = els.date.value;
  first.querySelector('[data-segment-field="start-time"]').value = els.start.value;
  last.querySelector('[data-segment-field="end-date"]').value = els.endDate.value;
  last.querySelector('[data-segment-field="end-time"]').value = els.end.value;
  els.segmentsError.textContent = "";
}

function syncMainDatesFromSegmentEditor(event) {
  const row = event.target.closest(".segment-row");
  if (!row) return;
  const rows = [...els.segmentsList.querySelectorAll(".segment-row")];
  if (row === rows[0]) {
    els.date.value = row.querySelector('[data-segment-field="start-date"]').value;
    els.start.value = row.querySelector('[data-segment-field="start-time"]').value;
  }
  if (row === rows.at(-1)) {
    els.endDate.value = row.querySelector('[data-segment-field="end-date"]').value;
    els.end.value = row.querySelector('[data-segment-field="end-time"]').value;
  }
  els.segmentsError.textContent = "";
  persistEntryDraft();
}

function startTrackingFromForm() {
  const task = cleanText(els.task.value).toUpperCase();
  if (!task) return;

  const now = new Date();
  const nowIso = now.toISOString();
  if (!state.tracking.allowSimultaneous) {
    pauseOtherActiveEntries(now);
  }

  const entry = normalizeEntry({
    id: createId(),
    date: toISODate(now),
    startDate: toISODate(now),
    endDate: "",
    task,
    description: els.description.value.trim(),
    notes: els.notes.value.trim(),
    start: formatTimeFromDate(now),
    end: "",
    createdAt: nowIso,
    updatedAt: nowIso,
    statusUpdatedAt: nowIso,
    syncVersion: APP_VERSION,
    tracked: true,
    status: "active",
    segments: [
      {
        id: createId(),
        startAt: nowIso,
        endAt: "",
        updatedAt: nowIso,
      },
    ],
  });

  state.entries.push(entry);
  state.deletedEntries = state.deletedEntries.filter((item) => item.id !== entry.id);
  persist();
  persistDeletedEntries();
  resetForm();
  render();
  scheduleAutoSync(300);
  closeEntryModalOnMobile();
}

function handleTrackingAction(event) {
  const button = event.target.closest("[data-tracking-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.trackingAction;
  const now = Date.now();
  if ((trackingActionLocks.get(id) || 0) > now) return;
  trackingActionLocks.set(id, now + TRACKING_ACTION_LOCK_MS);
  button.disabled = true;
  window.setTimeout(() => {
    if ((trackingActionLocks.get(id) || 0) <= Date.now()) {
      trackingActionLocks.delete(id);
      renderRunningTasks();
    }
  }, TRACKING_ACTION_LOCK_MS + 20);
  if (action === "pause") pauseTrackedEntry(id);
  if (action === "resume") resumeTrackedEntry(id);
  if (action === "finish") finishTrackedEntry(id);
  if (action === "edit") editEntry(id, { openModal: true });
}

function pauseTrackedEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry || entry.status !== "active") return;
  pauseEntryAt(entry, new Date());
  finishTrackingMutation();
}

function resumeTrackedEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry || entry.status !== "paused") return;

  const now = new Date();
  const nowIso = now.toISOString();
  if (!state.tracking.allowSimultaneous) {
    pauseOtherActiveEntries(now, entry.id);
  }

  entry.segments = [
    ...normalizeSegments(entry.segments),
    {
      id: createId(),
      startAt: nowIso,
      endAt: "",
      updatedAt: nowIso,
    },
  ];
  entry.status = "active";
  entry.statusUpdatedAt = nowIso;
  entry.updatedAt = nowIso;
  entry.end = "";
  entry.endDate = "";
  finishTrackingMutation();
}

function finishTrackedEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry || !entry.tracked || entry.status === "completed") return;

  const now = new Date();
  if (entry.status === "active") closeLatestOpenSegment(entry, now);
  const lastEnd = getLastSegmentEnd(entry);
  const nowIso = now.toISOString();
  entry.status = "completed";
  entry.statusUpdatedAt = nowIso;
  entry.updatedAt = nowIso;
  entry.end = lastEnd ? formatTimeFromDate(new Date(lastEnd)) : formatTimeFromDate(now);
  entry.endDate = lastEnd ? toISODate(new Date(lastEnd)) : toISODate(now);
  finishTrackingMutation();
}

function pauseOtherActiveEntries(at, exceptId = "") {
  state.entries.forEach((entry) => {
    if (entry.id !== exceptId && entry.tracked && entry.status === "active") {
      pauseEntryAt(entry, at);
    }
  });
}

function pauseEntryAt(entry, at) {
  closeLatestOpenSegment(entry, at);
  const timestamp = at.toISOString();
  entry.status = "paused";
  entry.statusUpdatedAt = timestamp;
  entry.updatedAt = timestamp;
  entry.end = formatTimeFromDate(at);
  entry.endDate = toISODate(at);
}

function closeLatestOpenSegment(entry, at) {
  const segments = normalizeSegments(entry.segments);
  const openIndex = segments.findLastIndex((segment) => !segment.endAt);
  if (openIndex < 0) {
    entry.segments = segments;
    return;
  }

  const startAt = new Date(segments[openIndex].startAt);
  const endAt = at < startAt ? startAt : at;
  segments[openIndex] = {
    ...segments[openIndex],
    endAt: endAt.toISOString(),
    updatedAt: endAt.toISOString(),
  };
  entry.segments = segments;
}

function getLastSegmentEnd(entry) {
  return normalizeSegments(entry.segments)
    .map((segment) => segment.endAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function getEditableEnd(entry) {
  if (!entry?.tracked) return entry?.end || "";
  if (entry.status === "active") return "";
  const lastEnd = getLastSegmentEnd(entry);
  return lastEnd ? formatTimeFromDate(new Date(lastEnd)) : entry.end || "";
}

function getEditableEndDate(entry) {
  if (!entry?.tracked) return entry?.endDate || entry?.startDate || entry?.date || "";
  if (entry.status === "active") return "";
  const lastEnd = getLastSegmentEnd(entry);
  return lastEnd ? toISODate(new Date(lastEnd)) : entry.endDate || entry.date || "";
}

function getTrackedEntries(status = "") {
  return state.entries.filter(
    (entry) => entry.tracked && (!status || entry.status === status),
  );
}

function enforceSingleActiveTask() {
  if (state.tracking.allowSimultaneous) return false;
  const active = getTrackedEntries("active").sort((a, b) =>
    compareDate(b.statusUpdatedAt || b.updatedAt, a.statusUpdatedAt || a.updatedAt),
  );
  if (active.length < 2) return false;

  const winnerDate = new Date(active[0].statusUpdatedAt || active[0].updatedAt);
  pauseOtherActiveEntries(
    Number.isNaN(winnerDate.getTime()) ? new Date() : winnerDate,
    active[0].id,
  );
  return true;
}

function finishTrackingMutation() {
  persist();
  render();
  scheduleAutoSync(300);
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
  els.date.value = entry.startDate || entry.date || todayISO();
  els.task.value = entry.task || TASKS[0];
  els.description.value = entry.description || "";
  els.notes.value = entry.notes || "";
  els.start.value = entry.start || "";
  els.end.value = getEditableEnd(entry);
  els.endDate.value = getEditableEndDate(entry);
  els.save.textContent = "Actualizar";
  setEntryFormLock(false, true);
  renderSegmentEditor(entry);
  updateTaskButtonState();
  highlightEditingEntry();
  if (options.openModal) openEntryModal();
  persistEntryDraft();
}

function resetForm() {
  state.editingId = null;
  els.form.reset();
  els.date.value = todayISO();
  els.endDate.value = todayISO();
  els.task.value = getTaskList()[0] || TASKS[0];
  els.save.textContent = "Guardar";
  setEntryFormLock(false, false);
  renderSegmentEditor(null);
  clearEntryDraft();
  updateTaskButtonState();
  renderEntries();
}

function setEntryFormLock(lockTimes, editing) {
  els.date.disabled = lockTimes;
  els.start.disabled = lockTimes;
  els.end.disabled = lockTimes;
  els.endDate.disabled = lockTimes;
  els.timeNowButtons.forEach((button) => {
    button.disabled = lockTimes;
  });
  els.timePickerButtons.forEach((button) => {
    button.disabled = lockTimes;
  });
  els.startTracking.disabled = editing;
}

function captureEntryDraft() {
  const activeElement = document.activeElement;
  const focusId =
    activeElement && els.form.contains(activeElement) ? activeElement.id : "";
  let selectionStart = null;
  let selectionEnd = null;

  if (focusId) {
    try {
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
    } catch {
      // Los campos de fecha y hora no exponen seleccion de texto.
    }
  }

  return {
    editingId: state.editingId || "",
    date: els.date.value,
    task: els.task.value,
    description: els.description.value,
    notes: els.notes.value,
    start: els.start.value,
    end: els.end.value,
    endDate: els.endDate.value,
    segmentDraft: captureSegmentDraft(),
    lockTimes: els.date.disabled,
    modalOpen: els.entryPanel.classList.contains("modal-open"),
    focusId,
    selectionStart,
    selectionEnd,
  };
}

function restoreEntryDraft(draft) {
  if (!draft) return;

  const editingExists = Boolean(
    draft.editingId && state.entries.some((entry) => entry.id === draft.editingId),
  );
  state.editingId = editingExists ? draft.editingId : null;

  if (
    draft.task &&
    !Array.from(els.task.options).some((option) => option.value === draft.task)
  ) {
    els.task.add(new Option(draft.task, draft.task));
  }

  els.date.value = draft.date || todayISO();
  els.task.value = draft.task || getTaskList()[0] || TASKS[0];
  els.description.value = draft.description || "";
  els.notes.value = draft.notes || "";
  els.start.value = draft.start || "";
  els.end.value = draft.end || "";
  els.endDate.value = draft.endDate || draft.date || todayISO();
  els.save.textContent = editingExists ? "Actualizar" : "Guardar";
  setEntryFormLock(editingExists && Boolean(draft.lockTimes), editingExists);
  const editingEntry = editingExists
    ? state.entries.find((entry) => entry.id === draft.editingId)
    : null;
  renderSegmentEditor(editingEntry, draft.segmentDraft?.length ? draft.segmentDraft : null);
  els.entryPanel.classList.toggle("modal-open", Boolean(draft.modalOpen));
  document.body.classList.toggle("entry-modal-open", Boolean(draft.modalOpen));
  updateTaskButtonState();

  if (!draft.focusId) return;
  window.requestAnimationFrame(() => {
    const field = document.getElementById(draft.focusId);
    if (!field || field.disabled) return;
    field.focus();
    if (
      typeof draft.selectionStart === "number" &&
      typeof draft.selectionEnd === "number" &&
      typeof field.setSelectionRange === "function"
    ) {
      try {
        field.setSelectionRange(draft.selectionStart, draft.selectionEnd);
      } catch {
        // Algunos controles nativos no permiten colocar el cursor.
      }
    }
  });
}

function persistEntryDraft() {
  saveEntryDraft(captureEntryDraft());
}

function saveEntryDraft(draft) {
  try {
    localStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // La entrada sigue funcionando aunque el navegador bloquee localStorage.
  }
}

function restoreSavedEntryDraft() {
  let saved = "";
  try {
    saved = localStorage.getItem(ENTRY_DRAFT_KEY) || "";
  } catch {
    // Se intentara recuperar la copia antigua de la sesion.
  }
  if (!saved) {
    try {
      saved = sessionStorage.getItem(ENTRY_DRAFT_KEY) || "";
    } catch {
      // No hay almacenamiento de sesion disponible.
    }
  }
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);
    restoreEntryDraft(draft);
    saveEntryDraft(draft);
  } catch {
    clearEntryDraft();
  }
}

function clearEntryDraft() {
  try {
    localStorage.removeItem(ENTRY_DRAFT_KEY);
  } catch {
    // No hay nada que limpiar si localStorage no esta disponible.
  }
  try {
    sessionStorage.removeItem(ENTRY_DRAFT_KEY);
  } catch {
    // Limpieza compatible con los borradores de versiones anteriores.
  }
}

function setTodayIfEmpty() {
  if (!els.date.value) els.date.value = todayISO();
  if (!els.endDate.value) els.endDate.value = els.date.value;
  if (!els.task.value) els.task.value = getTaskList()[0] || TASKS[0];
  updateTaskButtonState();
}

function setTimeToNow(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.value = nowTime();
  if (field === els.start) els.date.value = todayISO();
  if (field === els.end) els.endDate.value = todayISO();
  syncMainDatesToSegmentEditor();
  field.focus();
  persistEntryDraft();
}

function openTimePicker(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.focus();
  if (typeof field.showPicker !== "function") return;
  try {
    field.showPicker();
  } catch {
    // Algunos navegadores solo permiten abrirlo desde interacciones directas.
  }
}

function updateTaskButtonState() {
  document.querySelectorAll(".task-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.task === els.task.value);
  });
}

function updateDateFilterState() {
  const active = Boolean(
    state.dateFilter || state.yearFilter || state.monthFilter,
  );
  els.clearDateFilter.hidden = !active;
  els.dateFilter.classList.toggle("active", Boolean(state.dateFilter));
  els.yearFilter.classList.toggle("active", Boolean(state.yearFilter));
  els.monthFilter.classList.toggle("active", Boolean(state.monthFilter));
}

function render() {
  renderDataFilterOptions();
  renderStats();
  renderRunningTasks();
  renderEntries();
  renderCharts();
}

function renderFilteredData() {
  renderStats();
  renderEntries();
}

function renderRunningTasks() {
  const entries = getTrackedEntries()
    .filter((entry) => entry.status === "active" || entry.status === "paused")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return compareDate(
        b.statusUpdatedAt || b.updatedAt,
        a.statusUpdatedAt || a.updatedAt,
      );
    });
  const activeCount = entries.filter((entry) => entry.status === "active").length;
  const pausedCount = entries.length - activeCount;

  els.trackingSummary.textContent = entries.length
    ? `${activeCount} activa${activeCount === 1 ? "" : "s"} · ${pausedCount} pausada${
        pausedCount === 1 ? "" : "s"
      }`
    : "Sin tareas";

  if (!entries.length) {
    els.runningTasks.innerHTML =
      '<p class="tracking-empty">No hay tareas activas o pausadas.</p>';
    return;
  }

  els.runningTasks.innerHTML = entries
    .map((entry) => {
      const active = entry.status === "active";
      const segments = normalizeSegments(entry.segments);
      const actionLocked = (trackingActionLocks.get(entry.id) || 0) > Date.now();
      const disabled = actionLocked ? " disabled" : "";
      return `<article class="running-task ${active ? "active" : "paused"}">
        <div class="running-task-main">
          <span class="running-task-title">
            <strong>${escapeHtml(entry.task)}</strong>
            <small>${active ? "Activa" : "Pausada"}</small>
          </span>
          <span class="running-task-description">${escapeHtml(
            entry.description || "Sin descripcion",
          )}</span>
        </div>
        <div class="running-task-time">
          <strong>${formatRunningDuration(computeEntryMilliseconds(entry))}</strong>
          <small>${segments.length} tramo${segments.length === 1 ? "" : "s"}</small>
        </div>
        <div class="running-task-actions">
          <button class="ghost" type="button" data-tracking-action="${
            active ? "pause" : "resume"
          }" data-id="${escapeAttr(entry.id)}"${disabled}>${active ? "Pausar" : "Reanudar"}</button>
          <button class="ghost" type="button" data-tracking-action="edit" data-id="${escapeAttr(
            entry.id,
          )}"${disabled}>Editar</button>
          <button class="btn finish-task" type="button" data-tracking-action="finish" data-id="${escapeAttr(
            entry.id,
          )}"${disabled}>Finalizar</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderDataFilterOptions() {
  const yearValue = state.yearFilter;
  const monthValue = state.monthFilter;
  const years = getDataYears();

  els.yearFilter.innerHTML = [
    '<option value="">Año</option>',
    ...years.map((year) => `<option value="${year}">${year}</option>`),
  ].join("");
  els.yearFilter.value = years.includes(yearValue) ? yearValue : "";
  state.yearFilter = els.yearFilter.value;

  els.monthFilter.innerHTML = [
    '<option value="">Mes</option>',
    ...MONTHS.map(
      (month, index) =>
        `<option value="${String(index + 1).padStart(2, "0")}">${month}</option>`,
    ),
  ].join("");
  els.monthFilter.value = monthValue;
  state.monthFilter = els.monthFilter.value;
  updateDateFilterState();
}

function renderStats() {
  const rows = getFilteredRows();
  const stats = computeStats(rows);

  els.statAverage.textContent = minutesToDuration(stats.averageMinutes);
  els.statTotal.textContent = minutesToDuration(stats.totalMinutes);
  els.statDays.textContent = String(stats.workedDays);
  els.statEntries.textContent = String(rows.length);
  els.chartTotal.textContent = minutesToDuration(stats.totalMinutes);
}

function renderEntries() {
  const rows = sortRowsForDisplay(getFilteredRows());
  const filteredTotalMinutes = rows.reduce(
    (sum, row) => sum + row.partialMinutes,
    0,
  );
  const totalRow = `<tr class="daily-total-row">
      <td></td>
      <td>Total diario</td>
      <td></td>
      <td></td>
      <td class="num"></td>
      <td class="num"></td>
      <td class="num"></td>
      <td class="num"></td>
      <td class="num daily-cell">${minutesToDuration(filteredTotalMinutes)}</td>
      <td class="num"></td>
    </tr>`;

  els.body.innerHTML = rows
    .map(
      (row) => `<tr class="${row.id === state.editingId ? "selected" : ""} ${
        row.status === "active" ? "tracking-active-row" : ""
      } ${row.status === "paused" ? "tracking-paused-row" : ""}" data-id="${row.id}">
        <td>${formatDate(row.date)}</td>
        <td class="task-cell">${escapeHtml(row.task)}${
          row.status === "active"
            ? '<span class="row-status active">Activa</span>'
            : row.status === "paused"
              ? '<span class="row-status paused">Pausa</span>'
              : ""
        }</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.notes)}</td>
        <td class="num">${escapeHtml(row.start)}</td>
        <td class="num">${escapeHtml(row.end)}</td>
        <td class="num">${row.partialMinutes ? minutesToDuration(row.partialMinutes) : ""}</td>
        <td class="num">${row.totalMinutes ? minutesToDuration(row.totalMinutes) : ""}</td>
        <td class="num daily-cell">${row.dailyMinutes ? minutesToDuration(row.dailyMinutes) : ""}</td>
        <td class="num">${row.daysWork ?? ""}</td>
      </tr>`,
    )
    .join("") + totalRow;

  els.body.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () =>
      editEntry(row.dataset.id, { openModal: isMobileLayout() }),
    );
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
          <strong>${formatDate(row.date)} - ${escapeHtml(row.task)}${
            row.status === "active"
              ? " · Activa"
              : row.status === "paused"
                ? " · Pausa"
                : ""
          }</strong>
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
    card.addEventListener("click", () =>
      editEntry(card.dataset.id, { openModal: isMobileLayout() }),
    );
    card.addEventListener("dblclick", () =>
      editEntry(card.dataset.id, { openModal: true }),
    );
  });
}

function getFilteredRows() {
  return computeRows().filter(matchesSearch);
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
    "Horas",
    taskRows,
    total,
  );
  els.monthSummary.innerHTML = summaryMarkup(
    "MESES",
    "Horas",
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
      partialMinutes: computeEntryMinutes(entry),
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
  const workedDays = new Set(
    rows.map((row) => row.date).filter(Boolean),
  ).size;
  return {
    totalMinutes,
    workedDays,
    averageMinutes: workedDays ? Math.round(totalMinutes / workedDays) : 0,
  };
}

function matchesSearch(row) {
  if (state.dateFilter && row.date !== state.dateFilter) return false;
  if (state.yearFilter && !String(row.date || "").startsWith(state.yearFilter)) {
    return false;
  }
  if (state.monthFilter && String(row.date || "").slice(5, 7) !== state.monthFilter) {
    return false;
  }
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

function compareDate(a, b) {
  return cleanText(a).localeCompare(cleanText(b));
}

function computeEntryMinutes(entry) {
  return Math.round(computeEntryMilliseconds(entry) / 60000);
}

function computeEntryMilliseconds(entry) {
  const segments = normalizeSegments(entry.segments);
  if (!segments.length) {
    const startAt = localDateTime(entry.startDate || entry.date, entry.start);
    const endAt = localDateTime(
      entry.endDate || entry.startDate || entry.date,
      entry.end,
    );
    if (startAt && endAt && endAt >= startAt) return endAt - startAt;
    return computePartial(entry.start, entry.end) * 60000;
  }

  const now = Date.now();
  return segments.reduce((sum, segment) => {
    const start = new Date(segment.startAt).getTime();
    const end = segment.endAt ? new Date(segment.endAt).getTime() : now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return sum;
    return sum + (end - start);
  }, 0);
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

function formatRunningDuration(milliseconds) {
  const safe = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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

function formatTimeFromDate(date) {
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

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment, index) => {
      const startAt = normalizeTimestamp(segment?.startAt);
      const endAt = normalizeTimestamp(segment?.endAt);
      if (!startAt) return null;
      return {
        id: cleanText(segment.id) || `segment-${startAt}-${index}`,
        startAt,
        endAt: endAt && compareDate(endAt, startAt) >= 0 ? endAt : "",
        updatedAt:
          normalizeTimestamp(segment.updatedAt) || endAt || startAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareDate(a.startAt, b.startAt));
}

function normalizeEntry(entry, fallbackDate = new Date().toISOString()) {
  const updatedAt =
    normalizeTimestamp(entry.updatedAt || entry.createdAt) || fallbackDate;
  let segments = normalizeSegments(entry.segments);
  const tracked = Boolean(entry.tracked || segments.length);
  const allowedStatuses = new Set(["active", "paused", "completed"]);
  let status = allowedStatuses.has(entry.status)
    ? entry.status
    : segments.some((segment) => !segment.endAt)
      ? "active"
      : "completed";
  const statusUpdatedAt =
    normalizeTimestamp(entry.statusUpdatedAt) || updatedAt;

  if (tracked && status !== "active") {
    segments = segments.map((segment) => {
      if (segment.endAt) return segment;
      const safeEnd =
        compareDate(statusUpdatedAt, segment.startAt) >= 0
          ? statusUpdatedAt
          : segment.startAt;
      return { ...segment, endAt: safeEnd, updatedAt: safeEnd };
    });
  }
  if (tracked && status === "active" && !segments.some((segment) => !segment.endAt)) {
    status = "paused";
  }

  const firstStart = segments[0]?.startAt || "";
  const lastEnd = segments
    .map((segment) => segment.endAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
  const firstDate = firstStart ? new Date(firstStart) : null;
  const finalDate = lastEnd ? new Date(lastEnd) : null;
  const rawDate = parseDate(entry.date || entry.FECHA || entry.Fecha);
  const rawStart = parseTime(entry.start || entry["TIEMPO INICIO"] || entry.inicio);
  const rawEnd = parseTime(entry.end || entry["TIEMPO FINAL"] || entry.final);
  const rawStartDate = parseDate(entry.startDate) || rawDate;
  let rawEndDate = parseDate(entry.endDate) || rawStartDate;
  if (!entry.endDate && rawStart && rawEnd) {
    const legacyStart = localDateTime(rawStartDate, rawStart);
    const legacyEnd = localDateTime(rawEndDate, rawEnd);
    if (legacyStart && legacyEnd && legacyEnd < legacyStart) {
      legacyEnd.setDate(legacyEnd.getDate() + 1);
      rawEndDate = toISODate(legacyEnd);
    }
  }

  return {
    id: entry.id || createId(),
    date:
      tracked && firstDate && !Number.isNaN(firstDate.getTime())
        ? toISODate(firstDate)
        : rawDate,
    startDate:
      tracked && firstDate && !Number.isNaN(firstDate.getTime())
        ? toISODate(firstDate)
        : rawStartDate,
    endDate:
      tracked && finalDate && !Number.isNaN(finalDate.getTime())
        ? toISODate(finalDate)
        : rawEnd
          ? rawEndDate
          : "",
    task: cleanText(entry.task || entry.TAREA || entry.Tarea).toUpperCase(),
    description: cleanText(
      entry.description || entry.DESCRIPCION || entry.Descripcion,
    ),
    notes: cleanText(entry.notes || entry.Notas || entry.NOTAS),
    start:
      tracked && firstDate && !Number.isNaN(firstDate.getTime())
        ? formatTimeFromDate(firstDate)
        : rawStart,
    end:
      tracked && status !== "active" && finalDate && !Number.isNaN(finalDate.getTime())
        ? formatTimeFromDate(finalDate)
        : tracked
          ? ""
          : rawEnd,
    createdAt: normalizeTimestamp(entry.createdAt) || updatedAt,
    updatedAt,
    syncVersion: cleanText(entry.syncVersion),
    tracked,
    status,
    statusUpdatedAt,
    segments,
  };
}

function normalizeTimestamp(value) {
  const text = cleanText(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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

function normalizeTrackingSettings(settings) {
  return {
    allowSimultaneous: Boolean(settings?.allowSimultaneous),
    updatedAt: normalizeTimestamp(settings?.updatedAt),
  };
}

function loadTrackingSettings() {
  try {
    const saved = localStorage.getItem(TRACKING_SETTINGS_KEY);
    if (saved) return normalizeTrackingSettings(JSON.parse(saved));
  } catch {
    localStorage.removeItem(TRACKING_SETTINGS_KEY);
  }
  return normalizeTrackingSettings({});
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

function persistTrackingSettings() {
  localStorage.setItem(TRACKING_SETTINGS_KEY, JSON.stringify(state.tracking));
}

function persistAll() {
  persist();
  persistCustomTasks();
  persistDeletedTasks();
  persistDeletedEntries();
  persistTrackingSettings();
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
    if (backupData?.trackingSettings) {
      state.tracking = normalizeTrackingSettings(backupData.trackingSettings);
      persistTrackingSettings();
      setTrackingFormValues();
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
    startDate: findHeader(headers, ["fecha inicio"]),
    endDate: findHeader(headers, ["fecha final"]),
    task: findHeader(headers, ["tarea"]),
    description: findHeader(headers, ["descripcion", "descripcion"]),
    notes: findHeader(headers, ["notas"]),
    start: findHeader(headers, ["tiempo inicio", "inicio"]),
    end: findHeader(headers, ["tiempo final", "final"]),
    status: findHeader(headers, ["estado"]),
    tracked: findHeader(headers, ["seguimiento"]),
    segments: findHeader(headers, ["tramos"]),
  };

  return rows
    .slice(1)
    .map((row) =>
      normalizeEntry({
        id: createId(),
        date: row[index.date],
        startDate: row[index.startDate],
        endDate: row[index.endDate],
        task: row[index.task],
        description: row[index.description],
        notes: row[index.notes],
        start: row[index.start],
        end: row[index.end],
        status: row[index.status],
        tracked: /^(1|true|si)$/i.test(cleanText(row[index.tracked])),
        segments: parseSegmentsCell(row[index.segments]),
      }),
    )
    .filter((entry) => entry.date && entry.task);
}

function parseSegmentsCell(value) {
  const text = cleanText(value);
  if (!text) return [];
  try {
    return normalizeSegments(JSON.parse(text));
  } catch {
    return [];
  }
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
    "FECHA INICIO",
    "FECHA FINAL",
    "TAREA",
    "DESCRIPCION",
    "Notas",
    "TIEMPO INICIO",
    "TIEMPO FINAL",
    "ESTADO",
    "SEGUIMIENTO",
    "TRAMOS",
  ];
  const rows = state.entries
    .slice()
    .sort(compareEntries)
    .map((entry) =>
      [
        formatDate(entry.date),
        formatDate(entry.startDate || entry.date),
        formatDate(entry.endDate),
        entry.task,
        entry.description,
        entry.notes,
        entry.start,
        entry.end,
        entry.status,
        entry.tracked ? "SI" : "",
        entry.tracked ? JSON.stringify(normalizeSegments(entry.segments)) : "",
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
        trackingSettings: state.tracking,
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
