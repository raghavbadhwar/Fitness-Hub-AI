import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeVersioned,
  decodeVersionedWithLegacyFallback,
  encodeVersioned,
} from "./versioned-storage.ts";

test("encodes and decodes versioned payloads", () => {
  const raw = encodeVersioned({ classIds: ["a", "b"] });
  const decoded = decodeVersioned(raw, { classIds: [] });

  assert.deepEqual(decoded.value, { classIds: ["a", "b"] });
  assert.equal(decoded.shouldMigrate, false);
});

test("marks legacy payloads for migration", () => {
  const legacyRaw = JSON.stringify(["class-1", "class-2"]);
  const decoded = decodeVersioned<string[]>(legacyRaw, []);

  assert.deepEqual(decoded.value, ["class-1", "class-2"]);
  assert.equal(decoded.shouldMigrate, true);
});

test("falls back on malformed payloads", () => {
  const decoded = decodeVersioned("not-json", { ok: true });

  assert.deepEqual(decoded.value, { ok: true });
  assert.equal(decoded.shouldMigrate, false);
});

test("upgrades legacy schedule payloads from unscoped storage without dropping class ids", () => {
  const decodedEnrolled = decodeVersionedWithLegacyFallback<string[]>(
    null,
    JSON.stringify(["class-yoga", "class-hiit"]),
    [],
  );
  const decodedWaitlist = decodeVersionedWithLegacyFallback<string[]>(
    null,
    JSON.stringify(["class-boxing"]),
    [],
  );

  assert.deepEqual(decodedEnrolled.value, ["class-yoga", "class-hiit"]);
  assert.equal(decodedEnrolled.shouldMigrate, true);
  assert.equal(decodedEnrolled.usedLegacyFallback, true);
  assert.deepEqual(decodedWaitlist.value, ["class-boxing"]);
  assert.equal(decodedWaitlist.shouldMigrate, true);
  assert.equal(decodedWaitlist.usedLegacyFallback, true);
});

test("prefers scoped versioned schedule payloads over legacy fallback data", () => {
  const decoded = decodeVersionedWithLegacyFallback<string[]>(
    encodeVersioned(["scoped-class"]),
    JSON.stringify(["legacy-class"]),
    [],
  );

  assert.deepEqual(decoded.value, ["scoped-class"]);
  assert.equal(decoded.shouldMigrate, false);
  assert.equal(decoded.usedLegacyFallback, false);
});

test("upgrades legacy workout payloads without dropping sessions, records, or plans", () => {
  const legacySession = {
    id: "session-1",
    name: "Push Day",
    date: "2026-05-06",
    startTime: 1778000000000,
    exercises: [
      {
        id: "exercise-entry-1",
        exerciseId: "bench-press",
        name: "Bench Press",
        sets: [{ id: "set-1", weight: 80, reps: 5, completed: true }],
      },
    ],
    totalVolume: 400,
    caloriesBurned: 240,
    completed: true,
  };
  const legacyRecord = {
    exerciseId: "bench-press",
    name: "Bench Press",
    weight: 80,
    reps: 5,
    date: "2026-05-06",
  };
  const legacyPlan = {
    id: "plan-1",
    name: "Strength Base",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-06T08:00:00.000Z",
    source: "member",
    exercises: [{ exerciseId: "squat", name: "Squat", sets: 5, reps: 5 }],
  };

  const decodedSessions = decodeVersionedWithLegacyFallback<Array<typeof legacySession>>(
    null,
    JSON.stringify([legacySession]),
    [],
  );
  const decodedRecords = decodeVersionedWithLegacyFallback<Record<string, typeof legacyRecord>>(
    null,
    JSON.stringify({ "bench-press": legacyRecord }),
    {},
  );
  const decodedPlans = decodeVersionedWithLegacyFallback<Array<typeof legacyPlan>>(
    null,
    JSON.stringify([legacyPlan]),
    [],
  );

  assert.deepEqual(decodedSessions.value, [legacySession]);
  assert.equal(decodedSessions.shouldMigrate, true);
  assert.deepEqual(decodedRecords.value, { "bench-press": legacyRecord });
  assert.equal(decodedRecords.shouldMigrate, true);
  assert.deepEqual(decodedPlans.value, [legacyPlan]);
  assert.equal(decodedPlans.shouldMigrate, true);
});
