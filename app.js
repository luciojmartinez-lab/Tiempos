const STORAGE_KEY = "tiempos.entries.100v1";
const CUSTOM_TASKS_KEY = "tiempos.customTasks.100v2";
const DELETED_TASKS_KEY = "tiempos.deletedTasks.100v3";

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
  editingId: null,
  search: "",
  dateFilter: "",
  sortOrder: "desc",
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindElements();
  buildTaskControls();
  bindEvents();
  setTodayIfEmpty();
  updateDateFilterState();
  render();
  setInitialView();
  registerServiceWorker();
}

function bindElements() {
  Object.assign(els, {
    navItems: document.querySelectorAll(".nav-item"),
    views: document.querySelectorAll(".view"),
    taskButtons: document.getElementById("task-buttons"),
    newTaskInput: document.getElementById("new-task-input"),
    addTask: document.getElementById("add-task"),
    deleteTask: document.getElementById("delete-task"),
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
  els.loadFile.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", handleFileLoad);
  els.exportCsv.addEventListener("click", exportCsv);
  els.exportJson.addEventListener("click", exportJson);
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
  if (TASKS.includes(task) && !state.deletedTasks.includes(task)) {
    state.deletedTasks.push(task);
  }

  persistCustomTasks();
  persistDeletedTasks();
  buildTaskControls();
  els.task.value = getTaskList()[0] || "";
  updateTaskButtonState();
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
  setView(requested === "graficos" ? "graficos" : "datos");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

function saveCurrent(event) {
  event.preventDefault();

  const entry = {
    id: state.editingId || createId(),
    date: els.date.value || todayISO(),
    task: els.task.value,
    description: els.description.value.trim(),
    notes: els.notes.value.trim(),
    start: els.start.value,
    end: els.end.value,
  };

  if (state.editingId) {
    state.entries = state.entries.map((item) =>
      item.id === state.editingId ? entry : item,
    );
  } else {
    state.entries.push(entry);
  }

  persist();
  resetForm();
  render();
  closeEntryModalOnMobile();
}

function deleteCurrent() {
  if (!state.editingId) return;
  state.entries = state.entries.filter((entry) => entry.id !== state.editingId);
  persist();
  resetForm();
  render();
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
  const rows = computeRows();
  const byTask = groupMinutes(rows, (row) => row.task);
  const byMonth = groupMonths(rows);
  const taskRows = [...byTask.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter((item) => item[1] > 0);
  const monthRows = MONTHS.map((label, index) => [label, byMonth.get(index) || 0]);
  const total = taskRows.reduce((sum, item) => sum + item[1], 0);

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
    "TAREAS",
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

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return SAMPLE_ENTRIES;
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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function persistCustomTasks() {
  localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(state.customTasks));
}

function persistDeletedTasks() {
  localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(state.deletedTasks));
}

async function handleFileLoad() {
  const file = els.fileInput.files?.[0];
  if (!file) return;

  try {
    const extension = file.name.toLowerCase().split(".").pop();
    let entries;
    if (extension === "json") {
      entries = normalizeImportedEntries(JSON.parse(await file.text()));
    } else if (extension === "csv") {
      entries = rowsToEntries(parseCsv(await file.text()));
    } else if (extension === "xlsx" || extension === "xls") {
      entries = await importXlsx(file);
    } else {
      throw new Error("Formato no soportado");
    }

    if (!entries.length) throw new Error("No se han encontrado registros");
    state.entries = entries;
    persist();
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
    .map((row) => ({
      id: createId(),
      date: parseDate(row[index.date]),
      task: cleanText(row[index.task]).toUpperCase(),
      description: cleanText(row[index.description]),
      notes: cleanText(row[index.notes]),
      start: parseTime(row[index.start]),
      end: parseTime(row[index.end]),
    }))
    .filter((entry) => entry.date && entry.task);
}

function normalizeImportedEntries(input) {
  const list = Array.isArray(input) ? input : input.entries;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      id: item.id || createId(),
      date: parseDate(item.date || item.FECHA || item.Fecha),
      task: cleanText(item.task || item.TAREA || item.Tarea).toUpperCase(),
      description: cleanText(
        item.description || item.DESCRIPCION || item.Descripcion,
      ),
      notes: cleanText(item.notes || item.Notas || item.NOTAS),
      start: parseTime(item.start || item["TIEMPO INICIO"] || item.inicio),
      end: parseTime(item.end || item["TIEMPO FINAL"] || item.final),
    }))
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
    JSON.stringify({ entries: state.entries }, null, 2),
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
