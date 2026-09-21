"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { dueReminderPlan } = require("../server/reminder-policy");

test("server sends only the latest due stage after downtime", () => {
  const now = Date.parse("2026-09-21T10:00:00.000Z");
  const schedule = {
    deadline: new Date(now + 30 * 60000).toISOString(),
    reminders: [
      { kind: "notice", at: new Date(now - 60 * 60000).toISOString() },
      { kind: "urgent", at: new Date(now - 30 * 60000).toISOString() },
      { kind: "danger", at: new Date(now + 10 * 60000).toISOString() }
    ]
  };
  const plan = dueReminderPlan(schedule, now);
  assert.equal(plan.latest.kind, "urgent");
  assert.deepEqual(plan.skipped.map(reminder => reminder.kind), ["notice"]);
  assert.equal(dueReminderPlan({ ...schedule, deadline: new Date(now - 1).toISOString() }, now).latest, null);
});
