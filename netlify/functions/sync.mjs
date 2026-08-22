import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "tiempos-sync";
const SYNC_VERSION = "100v27";
const BULK_MIGRATION_LIMIT = 5;
const LEGACY_UPDATED_AT = "2000-01-01T00:00:00.000Z";

export default async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({});
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  try {
    const payload = await req.json();
    const syncKey = cleanText(payload.syncKey);
    if (syncKey.length < 4) {
      return jsonResponse({ error: "Clave demasiado corta" }, 400);
    }

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const keyId = hashKey(syncKey);
    const key = `keys/${keyId}.json`;
    const remote = repairStore((await store.get(key, { type: "json" })) || emptyStore());
    const mode = cleanText(payload.mode) || "merge";
    if (mode === "status") {
      return jsonResponse(withDiagnostics(remote, keyId, new Date().toISOString()));
    }
    if (mode === "pull") {
      return jsonResponse(withDiagnostics(remote, keyId, new Date().toISOString()));
    }

    const merged =
      mode === "replace" || shouldUseCloudOnly(remote, payload)
        ? mode === "replace"
          ? replaceStore(payload)
          : remote
        : mergeStores(remote, payload);
    enforceTrackingPolicy(merged);
    merged.updatedAt = new Date().toISOString();
    if (mode === "replace") merged.resetAt = merged.updatedAt;

    await store.setJSON(key, merged);

    return jsonResponse(withDiagnostics(merged, keyId, merged.updatedAt));
  } catch (error) {
    return jsonResponse(
      { error: error?.message || "No se pudo sincronizar" },
      500,
    );
  }
};

export const config = {
  path: "/api/sync",
  method: ["POST", "OPTIONS"],
};

function mergeStores(remote, incoming) {
  remote = repairStore(remote);
  let incomingEntries = repairLegacyMigrationEntries(incoming.entries || []);
  let incomingDeletedEntries = (incoming.deletedEntries || []).map(normalizeTombstone);
  if (remote.resetAt) {
    incomingEntries = filterIncomingAfterReset(
      incomingEntries,
      remote.entries,
      remote.resetAt,
    );
    incomingDeletedEntries = incomingDeletedEntries.filter(
      (item) => compareDate(getRecordDate(item), remote.resetAt) > 0,
    );
  }
  const merged = {
    entries: [],
    deletedEntries: [],
    customTasks: uniqueTasks([
      ...(remote.customTasks || []),
      ...(incoming.customTasks || []),
    ]),
    deletedTasks: uniqueTasks([
      ...(remote.deletedTasks || []),
      ...(incoming.deletedTasks || []),
    ]),
    trackingSettings: mergeTrackingSettings(
      remote.trackingSettings,
      incoming.trackingSettings,
    ),
    updatedAt: remote.updatedAt || "",
    resetAt: remote.resetAt || "",
  };

  const records = new Map();
  addRecords(records, remote.entries || [], false);
  addRecords(records, incomingEntries, false);
  addRecords(records, remote.deletedEntries || [], true);
  addRecords(records, incomingDeletedEntries, true);

  for (const record of records.values()) {
    if (record.deleted) {
      merged.deletedEntries.push(normalizeTombstone(record.value));
    } else {
      merged.entries.push(normalizeEntry(record.value));
    }
  }

  merged.entries.sort(compareEntries);
  merged.deletedEntries.sort((a, b) => compareDate(a.updatedAt, b.updatedAt));
  return merged;
}

function replaceStore(incoming) {
  const deletedIds = new Set(
    (incoming.deletedEntries || []).map((item) => cleanText(item.id)),
  );
  return {
    entries: repairLegacyMigrationEntries(incoming.entries || [])
      .filter((entry) => entry.id && !deletedIds.has(entry.id))
      .sort(compareEntries),
    deletedEntries: (incoming.deletedEntries || [])
      .map(normalizeTombstone)
      .filter((item) => item.id),
    customTasks: uniqueTasks(incoming.customTasks || []),
    deletedTasks: uniqueTasks(incoming.deletedTasks || []),
    trackingSettings: normalizeTrackingSettings(incoming.trackingSettings),
    updatedAt: "",
    resetAt: "",
  };
}

function repairStore(store) {
  const deletedIds = new Set(
    (store.deletedEntries || []).map((item) => cleanText(item.id)),
  );
  return {
    entries: repairLegacyMigrationEntries(store.entries || [])
      .filter((entry) => entry.id && !deletedIds.has(entry.id))
      .sort(compareEntries),
    deletedEntries: (store.deletedEntries || [])
      .map(normalizeTombstone)
      .filter((item) => item.id),
    customTasks: uniqueTasks(store.customTasks || []),
    deletedTasks: uniqueTasks(store.deletedTasks || []),
    trackingSettings: normalizeTrackingSettings(store.trackingSettings),
    updatedAt: cleanText(store.updatedAt),
    resetAt: cleanText(store.resetAt),
  };
}

function shouldUseCloudOnly(remote, incoming) {
  if (!remote.resetAt) return false;
  const clientLastSyncedAt = cleanText(incoming.clientLastSyncedAt);
  return !clientLastSyncedAt || compareDate(clientLastSyncedAt, remote.resetAt) < 0;
}

function withDiagnostics(store, keyId, syncedAt) {
  return {
    ...store,
    syncedAt,
    keyId: keyId.slice(0, 8),
    cloudSummary: summarizeStore(store),
  };
}

function summarizeStore(store) {
  const latestRows = (store.entries || [])
    .slice()
    .sort((a, b) =>
      `${b.date || ""} ${b.start || ""} ${b.id}`.localeCompare(
        `${a.date || ""} ${a.start || ""} ${a.id}`,
      ),
    )
    .slice(0, 5)
    .map((entry) => ({
      date: entry.date,
      task: entry.task,
      start: entry.start,
      end: entry.end,
      description: entry.description,
    }));

  return {
    entriesCount: (store.entries || []).length,
    deletedCount: (store.deletedEntries || []).length,
    updatedAt: store.updatedAt || "",
    resetAt: store.resetAt || "",
    latestRows,
  };
}

function filterIncomingAfterReset(incomingEntries, remoteEntries, resetAt) {
  const remoteIds = new Set(remoteEntries.map((entry) => entry.id));
  return incomingEntries.filter(
    (entry) =>
      remoteIds.has(entry.id) || compareDate(getRecordDate(entry), resetAt) > 0,
  );
}

function addRecords(records, list, deleted) {
  list.forEach((item) => {
    const value = deleted ? normalizeTombstone(item) : normalizeEntry(item);
    if (!value.id) return;

    const previous = records.get(value.id);
    if (previous && !previous.deleted && !deleted) {
      records.set(value.id, {
        deleted: false,
        value: mergeEntryValues(previous.value, value),
      });
      return;
    }
    const nextDate = getRecordDate(value);
    const previousDate = previous ? getRecordDate(previous.value) : "";
    if (!previous || compareDate(nextDate, previousDate) > 0) {
      records.set(value.id, { deleted, value });
    }
  });
}

function mergeEntryValues(first, second) {
  first = normalizeEntry(first);
  second = normalizeEntry(second);
  const firstIsNewer =
    compareDate(getRecordDate(first), getRecordDate(second)) >= 0;
  const newer = firstIsNewer ? first : second;
  const older = firstIsNewer ? second : first;
  const statusSource =
    compareDate(first.statusUpdatedAt, second.statusUpdatedAt) >= 0
      ? first
      : second;
  const segments = new Map();

  [...older.segments, ...newer.segments].forEach((segment) => {
    const previous = segments.get(segment.id);
    if (
      !previous ||
      compareDate(segment.updatedAt, previous.updatedAt) > 0
    ) {
      segments.set(segment.id, segment);
    }
  });

  return normalizeEntry({
    ...newer,
    createdAt:
      compareDate(first.createdAt, second.createdAt) <= 0
        ? first.createdAt
        : second.createdAt,
    tracked: first.tracked || second.tracked,
    status: statusSource.status,
    statusUpdatedAt: statusSource.statusUpdatedAt,
    end: statusSource.end,
    segments: [...segments.values()],
  });
}

function normalizeEntry(entry) {
  const updatedAt = cleanText(entry.updatedAt || entry.createdAt) || now();
  let segments = normalizeSegments(entry.segments);
  const tracked = Boolean(entry.tracked || segments.length);
  const allowedStatuses = new Set(["active", "paused", "completed"]);
  let status = allowedStatuses.has(entry.status)
    ? entry.status
    : segments.some((segment) => !segment.endAt)
      ? "active"
      : "completed";
  const statusUpdatedAt =
    cleanTimestamp(entry.statusUpdatedAt) || cleanTimestamp(updatedAt) || now();

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

  return {
    id: cleanText(entry.id),
    date: cleanText(entry.date),
    startDate: cleanText(entry.startDate || entry.date),
    endDate: cleanText(entry.endDate),
    task: cleanText(entry.task).toUpperCase(),
    description: cleanText(entry.description),
    notes: cleanText(entry.notes),
    start: cleanText(entry.start),
    end: tracked && status === "active" ? "" : cleanText(entry.end),
    createdAt: cleanText(entry.createdAt) || updatedAt,
    updatedAt,
    syncVersion: cleanText(entry.syncVersion),
    tracked,
    status,
    statusUpdatedAt,
    segments,
  };
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment, index) => {
      const startAt = cleanTimestamp(segment?.startAt);
      const endAt = cleanTimestamp(segment?.endAt);
      if (!startAt) return null;
      return {
        id: cleanText(segment.id) || `segment-${startAt}-${index}`,
        startAt,
        endAt: endAt && compareDate(endAt, startAt) >= 0 ? endAt : "",
        updatedAt:
          cleanTimestamp(segment.updatedAt) || endAt || startAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareDate(a.startAt, b.startAt));
}

function normalizeTrackingSettings(settings) {
  return {
    allowSimultaneous: Boolean(settings?.allowSimultaneous),
    updatedAt: cleanTimestamp(settings?.updatedAt),
  };
}

function mergeTrackingSettings(first, second) {
  first = normalizeTrackingSettings(first);
  second = normalizeTrackingSettings(second);
  return compareDate(second.updatedAt, first.updatedAt) > 0 ? second : first;
}

function enforceTrackingPolicy(store) {
  store.trackingSettings = normalizeTrackingSettings(store.trackingSettings);
  if (store.trackingSettings.allowSimultaneous) return;

  const active = store.entries
    .filter((entry) => entry.tracked && entry.status === "active")
    .sort(
      (a, b) =>
        compareDate(
          b.statusUpdatedAt || b.updatedAt,
          a.statusUpdatedAt || a.updatedAt,
        ) || cleanText(b.id).localeCompare(cleanText(a.id)),
    );
  if (active.length < 2) return;

  const winner = active[0];
  const pauseAt =
    cleanTimestamp(winner.statusUpdatedAt || winner.updatedAt) || now();
  const activeIds = new Set(active.slice(1).map((entry) => entry.id));
  store.entries = store.entries.map((entry) => {
    if (!activeIds.has(entry.id)) return entry;
    return pauseEntry(entry, pauseAt);
  });
}

function pauseEntry(entry, pauseAt) {
  const segments = normalizeSegments(entry.segments);
  const openIndex = segments.findLastIndex((segment) => !segment.endAt);
  if (openIndex >= 0) {
    const safeEnd =
      compareDate(pauseAt, segments[openIndex].startAt) >= 0
        ? pauseAt
        : segments[openIndex].startAt;
    segments[openIndex] = {
      ...segments[openIndex],
      endAt: safeEnd,
      updatedAt: safeEnd,
    };
  }
  return normalizeEntry({
    ...entry,
    status: "paused",
    statusUpdatedAt: pauseAt,
    updatedAt: pauseAt,
    end: "",
    segments,
  });
}

function normalizeTombstone(item) {
  const updatedAt = cleanText(item.updatedAt || item.deletedAt) || now();
  return {
    id: cleanText(item.id),
    task: cleanText(item.task).toUpperCase(),
    deletedAt: cleanText(item.deletedAt) || updatedAt,
    updatedAt,
  };
}

function getRecordDate(record) {
  return cleanText(record.updatedAt || record.deletedAt || record.createdAt);
}

function repairLegacyMigrationEntries(entries) {
  const normalized = entries.map(normalizeEntry);
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
        syncVersion: SYNC_VERSION,
      };
    }
    return { ...entry, syncVersion: entry.syncVersion || SYNC_VERSION };
  });
}

function isBulkMigrationCandidate(entry) {
  return (
    !entry.syncVersion &&
    Boolean(entry.createdAt) &&
    entry.createdAt === entry.updatedAt
  );
}

function compareEntries(a, b) {
  return `${a.date || ""} ${a.start || ""} ${a.id}`.localeCompare(
    `${b.date || ""} ${b.start || ""} ${b.id}`,
  );
}

function compareDate(a, b) {
  return cleanText(a).localeCompare(cleanText(b));
}

function cleanTimestamp(value) {
  const text = cleanText(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function uniqueTasks(tasks) {
  return [
    ...new Set(tasks.map((task) => cleanText(task).toUpperCase()).filter(Boolean)),
  ];
}

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

function emptyStore() {
  return {
    entries: [],
    deletedEntries: [],
    customTasks: [],
    deletedTasks: [],
    trackingSettings: normalizeTrackingSettings({}),
    updatedAt: "",
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value) {
  return value == null ? "" : String(value).trim();
}

function now() {
  return new Date().toISOString();
}
