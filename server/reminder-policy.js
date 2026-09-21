"use strict";

function dueReminderPlan(schedule, now = Date.now()) {
  if (!schedule || Date.parse(schedule.deadline) <= now || !Array.isArray(schedule.reminders)) {
    return { latest: null, skipped: [] };
  }
  const due = schedule.reminders
    .filter(reminder => !reminder.sentAt && !reminder.skippedAt && Date.parse(reminder.at) <= now)
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  return { latest: due.at(-1) || null, skipped: due.slice(0, -1) };
}

module.exports = { dueReminderPlan };
