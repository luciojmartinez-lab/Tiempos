import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "tiempos-sync";
const SYNC_VERSION = "100v21";
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
    const nextDate = getRecordDate(value);
    const previousDate = previous ? getRecordDate(previous.value) : "";
    if (!previous || compareDate(nextDate, previousDate) > 0) {
      records.set(value.id, { deleted, value });
    }
  });
}

function normalizeEntry(entry) {
  const updatedAt = cleanText(entry.updatedAt || entry.createdAt) || now();
  return {
    id: cleanText(entry.id),
    date: cleanText(entry.date),
    task: cleanText(entry.task).toUpperCase(),
    description: cleanText(entry.description),
    notes: cleanText(entry.notes),
    start: cleanText(entry.start),
    end: cleanText(entry.end),
    createdAt: cleanText(entry.createdAt) || updatedAt,
    updatedAt,
    syncVersion: cleanText(entry.syncVersion),
  };
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
