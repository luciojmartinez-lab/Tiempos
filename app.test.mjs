import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const storageData = new Map();
const context = vm.createContext({
  console,
  Date,
  Math,
  Intl,
  document: { addEventListener() {} },
  window: { setTimeout() {} },
  localStorage: {
    getItem(key) { return storageData.get(key) ?? null; },
    setItem(key, value) { storageData.set(key, value); },
    removeItem(key) { storageData.delete(key); },
  },
});
vm.runInContext(fs.readFileSync(new URL("./app.js", import.meta.url), "utf8"), context);

const legacyOvernight = context.normalizeEntry({
  id: "legacy",
  date: "2026-08-20",
  task: "UNI",
  start: "23:00",
  end: "01:00",
});
assert.equal(legacyOvernight.startDate, "2026-08-20");
assert.equal(legacyOvernight.endDate, "2026-08-21");
assert.equal(context.computeEntryMinutes(legacyOvernight), 120);

const tracked = context.normalizeEntry({
  id: "tracked",
  task: "PROGRAMACION",
  tracked: true,
  status: "paused",
  updatedAt: "2026-08-21T01:00:00.000Z",
  segments: [
    {
      id: "one",
      startAt: "2026-08-20T22:00:00.000Z",
      endAt: "2026-08-20T23:00:00.000Z",
    },
    {
      id: "two",
      startAt: "2026-08-21T00:00:00.000Z",
      endAt: "2026-08-21T01:00:00.000Z",
    },
  ],
});
assert.equal(tracked.startDate, context.toISODate(new Date(tracked.segments[0].startAt)));
assert.equal(tracked.endDate, context.toISODate(new Date(tracked.segments[1].endAt)));
assert.equal(context.computeEntryMinutes(tracked), 120);

const activeAfterRestart = context.normalizeEntry(JSON.parse(JSON.stringify({
  id: "active-restart",
  date: "2026-08-22",
  task: "UNI",
  tracked: true,
  status: "active",
  updatedAt: "2026-08-22T09:00:00.000Z",
  statusUpdatedAt: "2026-08-22T09:00:00.000Z",
  segments: [{
    id: "open",
    startAt: "2026-08-22T09:00:00.000Z",
    endAt: "",
  }],
})));
assert.equal(activeAfterRestart.status, "active");
assert.equal(activeAfterRestart.segments[0].endAt, "");

function segmentRow(id, startDate, startTime, endDate, endTime) {
  const values = { "start-date": startDate, "start-time": startTime, "end-date": endDate, "end-time": endTime };
  return {
    dataset: { segmentId: id },
    querySelector(selector) {
      const field = selector.match(/data-segment-field="([^"]+)"/)?.[1];
      return { value: values[field] };
    },
  };
}

context.testError = { textContent: "", scrollIntoView() {} };
context.testList = {
  querySelectorAll() {
    return [
      segmentRow("one", "2026-08-20", "09:00", "2026-08-20", "10:00"),
      segmentRow("two", "2026-08-20", "10:30", "2026-08-21", "11:00"),
      segmentRow("new", "2026-08-21", "12:00", "2026-08-21", "13:00"),
    ];
  },
};
vm.runInContext(
  "Object.assign(els, { segmentsList: testList, segmentsError: testError })",
  context,
);
const edited = context.readEditedSegments(
  "2026-08-22T10:00:00.000Z",
  "paused",
  [{
    id: "one",
    startAt: new Date(2026, 7, 20, 9, 0).toISOString(),
    endAt: new Date(2026, 7, 20, 10, 0).toISOString(),
    updatedAt: "2026-08-20T10:00:00.000Z",
  }],
);
assert.equal(edited.segments.length, 3);
assert.equal(edited.hasOpenSegment, false);
assert.equal(edited.segments[0].updatedAt, "2026-08-20T10:00:00.000Z");

context.testList.querySelectorAll = () => [
  segmentRow("one", "2026-08-20", "09:00", "2026-08-20", "11:00"),
  segmentRow("two", "2026-08-20", "10:30", "2026-08-20", "12:00"),
];
assert.equal(
  context.readEditedSegments("2026-08-22T10:00:00.000Z", "paused"),
  null,
);
assert.match(context.testError.textContent, /solaparse/);

vm.runInContext(
  `finishTrackingMutation = () => {};
   state.entries = [{
     id: "tap-test",
     tracked: true,
     status: "active",
     start: "09:00",
     end: "",
     segments: [{
       id: "tap-segment",
       startAt: "2026-08-22T09:00:00.000Z",
       endAt: "",
       updatedAt: "2026-08-22T09:00:00.000Z"
     }]
   }];`,
  context,
);
const trackingEvent = (action) => ({
  target: {
    closest() {
      return { dataset: { id: "tap-test", trackingAction: action }, disabled: false };
    },
  },
});
context.handleTrackingAction(trackingEvent("pause"));
context.handleTrackingAction(trackingEvent("resume"));
assert.equal(vm.runInContext('state.entries[0].status', context), "paused");
assert.equal(vm.runInContext('state.entries[0].segments.length', context), 1);

context.saveEntryDraft({ editingId: "tracked", segmentDraft: [{ id: "new" }] });
assert.equal(storageData.size > 0, true);
assert.equal(
  [...storageData.values()].some((value) => value.includes('"editingId":"tracked"')),
  true,
);
context.clearEntryDraft();
assert.equal(
  [...storageData.values()].some((value) => value.includes('"editingId":"tracked"')),
  false,
);

console.log("Pruebas de fechas y tramos superadas.");
