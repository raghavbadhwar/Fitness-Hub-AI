import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const classesById = new Map();

const gymClassesTable = {
  id: Symbol("id"),
  name: Symbol("name"),
  category: Symbol("category"),
  description: Symbol("description"),
  trainer: Symbol("trainer"),
  date: Symbol("date"),
  startTime: Symbol("startTime"),
  duration: Symbol("duration"),
  maxParticipants: Symbol("maxParticipants"),
  enrolledCount: Symbol("enrolledCount"),
  enrolledMemberIds: Symbol("enrolledMemberIds"),
  room: Symbol("room"),
  status: Symbol("status"),
  color: Symbol("color"),
  createdAt: Symbol("createdAt"),
  updatedAt: Symbol("updatedAt"),
};

const classFieldMap = new Map([
  [gymClassesTable.id, "id"],
  [gymClassesTable.name, "name"],
  [gymClassesTable.category, "category"],
  [gymClassesTable.description, "description"],
  [gymClassesTable.trainer, "trainer"],
  [gymClassesTable.date, "date"],
  [gymClassesTable.startTime, "startTime"],
  [gymClassesTable.duration, "duration"],
  [gymClassesTable.maxParticipants, "maxParticipants"],
  [gymClassesTable.enrolledCount, "enrolledCount"],
  [gymClassesTable.enrolledMemberIds, "enrolledMemberIds"],
  [gymClassesTable.room, "room"],
  [gymClassesTable.status, "status"],
  [gymClassesTable.color, "color"],
  [gymClassesTable.createdAt, "createdAt"],
  [gymClassesTable.updatedAt, "updatedAt"],
]);

function cloneClass(cls) {
  return {
    ...cls,
    enrolledMemberIds: [...cls.enrolledMemberIds],
    createdAt: new Date(cls.createdAt),
    updatedAt: new Date(cls.updatedAt),
  };
}

function seedClass(id, overrides = {}) {
  return {
    id,
    name: `Class ${id}`,
    category: "strength",
    description: "Structured test class",
    trainer: "Coach Riley",
    date: "2026-04-25",
    startTime: "09:00:00",
    duration: 45,
    maxParticipants: 2,
    enrolledCount: 0,
    enrolledMemberIds: [],
    room: "Studio A",
    status: "scheduled",
    color: "#0f766e",
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    updatedAt: new Date("2026-04-20T09:00:00.000Z"),
    ...overrides,
  };
}

function projectClass(cls, selection) {
  if (!selection) {
    return cloneClass(cls);
  }

  return Object.fromEntries(
    Object.entries(selection).map(([key, field]) => [
      key,
      cloneClass(cls)[classFieldMap.get(field)],
    ]),
  );
}

function filterClasses(condition) {
  let rows = [...classesById.values()].map(cloneClass);

  if (condition?.op === "gte") {
    rows = rows.filter((cls) => cls.date >= condition.value);
  }

  return rows;
}

function sortClasses(rows) {
  return [...rows].sort((left, right) => {
    const leftKey = `${left.date}T${left.startTime}`;
    const rightKey = `${right.date}T${right.startTime}`;
    return leftKey.localeCompare(rightKey);
  });
}

class SelectQuery {
  constructor(rows, selection) {
    this.rows = rows;
    this.selection = selection;
  }

  orderBy() {
    return Promise.resolve(sortClasses(this.rows).map((cls) => projectClass(cls, this.selection)));
  }

  then(resolve, reject) {
    return Promise.resolve(this.rows.map((cls) => projectClass(cls, this.selection))).then(
      resolve,
      reject,
    );
  }
}

const db = {
  select(selection) {
    return {
      from() {
        return {
          where(condition) {
            return new SelectQuery(filterClasses(condition), selection);
          },
        };
      },
    };
  },
};

function toLockedRow(cls) {
  return {
    id: cls.id,
    name: cls.name,
    category: cls.category,
    description: cls.description,
    trainer: cls.trainer,
    date: cls.date,
    start_time: cls.startTime,
    duration: cls.duration,
    max_participants: cls.maxParticipants,
    enrolled_count: cls.enrolledCount,
    enrolled_member_ids: [...cls.enrolledMemberIds],
    room: cls.room,
    status: cls.status,
    color: cls.color,
    created_at: cls.createdAt,
    updated_at: cls.updatedAt,
  };
}

const pool = {
  async connect() {
    return {
      async query(queryText, values = []) {
        if (queryText === "BEGIN" || queryText === "COMMIT" || queryText === "ROLLBACK") {
          return { rows: [] };
        }

        if (queryText.includes("FROM gym_classes") && queryText.includes("FOR UPDATE")) {
          const cls = classesById.get(values[0]);
          return { rows: cls ? [toLockedRow(cloneClass(cls))] : [] };
        }

        if (queryText.includes("UPDATE gym_classes")) {
          const [classId, enrolledCount, enrolledMemberIdsJson] = values;
          const cls = classesById.get(classId);
          if (!cls) {
            return { rows: [] };
          }

          const updated = {
            ...cls,
            enrolledCount,
            enrolledMemberIds: JSON.parse(enrolledMemberIdsJson),
            updatedAt: new Date("2026-04-20T10:00:00.000Z"),
          };
          classesById.set(classId, cloneClass(updated));
          return { rows: [toLockedRow(updated)] };
        }

        throw new Error(`Unexpected SQL in test double: ${queryText}`);
      },
      release() {},
    };
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    gte(field, value) {
      return { op: "gte", field, value };
    },
    eq(field, value) {
      return { op: "eq", field, value };
    },
  },
});

mock.module("@clerk/express", {
  namedExports: {
    requireAuth() {
      return (_req, _res, next) => next();
    },
    getAuth() {
      return { userId: authState.userId };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db,
    gymClassesTable,
    pool,
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    async requireApprovedAccess(_req, res) {
      if (!authState.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }

      return {
        allowed: true,
        userId: authState.userId,
        email: "member@example.com",
        role: "member",
        profile: null,
        control: null,
      };
    },
  },
});

const { default: classesRouter } = await import("../../src/routes/classes.ts");

const app = express();
app.use(express.json());
app.use(classesRouter);

beforeEach(() => {
  authState.userId = "member_1";
  classesById.clear();
  classesById.set(1, seedClass(1));
  classesById.set(
    2,
    seedClass(2, {
      date: "2026-04-26",
      startTime: "08:30:00",
      enrolledCount: 1,
      enrolledMemberIds: ["member_1"],
    }),
  );
});

describe("classes routes", () => {
  it("lists currently enrolled class ids for the caller", async () => {
    const response = await request(app).get("/classes/enrolled");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { classIds: ["2"] });
  });

  it("enrolls the caller into an available class", async () => {
    const response = await request(app).post("/classes/1/enroll");

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 1);
    assert.equal(response.body.enrolledCount, 1);
    assert.equal(classesById.get(1).enrolledCount, 1);
    assert.deepEqual(classesById.get(1).enrolledMemberIds, ["member_1"]);
  });

  it("does not double-enroll the same caller", async () => {
    await request(app).post("/classes/1/enroll");
    const response = await request(app).post("/classes/1/enroll");

    assert.equal(response.status, 200);
    assert.equal(response.body.enrolledCount, 1);
    assert.deepEqual(classesById.get(1).enrolledMemberIds, ["member_1"]);
  });

  it("returns a conflict when the class is already full", async () => {
    classesById.set(
      1,
      seedClass(1, {
        enrolledCount: 2,
        enrolledMemberIds: ["member_9", "member_8"],
        maxParticipants: 2,
      }),
    );

    const response = await request(app).post("/classes/1/enroll");

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, { error: "Class is full" });
    assert.equal(classesById.get(1).enrolledCount, 2);
  });

  it("removes the caller from an enrolled class", async () => {
    const response = await request(app).delete("/classes/2/enroll");

    assert.equal(response.status, 200);
    assert.equal(response.body.enrolledCount, 0);
    assert.deepEqual(classesById.get(2).enrolledMemberIds, []);
  });
});
