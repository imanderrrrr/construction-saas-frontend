import type { TaskResponse, TaskStatus } from '../../services/tasks';

/**
 * The five urgency groups that replaced the four kanban columns.
 *
 * The step stopped being the axis of the screen because the server's ladder
 * only goes forward: four columns you can drag between promise a way back that
 * does not exist. What the screen is asked on Monday morning is *when*, and
 * the two dates the model has always carried — start and due — were printed in
 * grey and used for nothing.
 *
 * Pure functions, deliberately: the grouping is the one piece of this section
 * that must never disagree with the counters the server sends.
 */

export type GroupKey = 'overdue' | 'today' | 'week' | 'noDates' | 'closed';

/** In reading order. The first two are drawn even when empty; the last three vanish. */
export const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'week', 'noDates', 'closed'];

/** Overdue and Due today answer the question that brings anyone to this screen. */
export const ALWAYS_SHOWN: GroupKey[] = ['overdue', 'today'];

/** A bare business date ("2026-09-12") is a local day, never a UTC instant. */
export function parseDay(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}

/** Midnight of `d`, so day comparisons never depend on the time of day. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days between two dates, counted on the calendar rather than in hours. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/**
 * Days late = today − due date, in calendar days.
 *
 * Its own function because the concept management review found the two numbers
 * of this redesign sharing a cell in the concept sheets: how late a task is,
 * and how long it has sat in its step. They are different questions and they
 * never appear together.
 */
export function daysLate(task: TaskResponse, today = new Date()): number | null {
  if (!task.dueDate || task.status === 'DONE') return null;
  const late = daysBetween(parseDay(task.dueDate), today);
  return late > 0 ? late : null;
}

/** Days the task has sat in its current step. Null when the server did not send the mark. */
export function daysInStep(task: TaskResponse, today = new Date()): number | null {
  if (!task.stepSince) return null;
  return Math.max(0, daysBetween(new Date(task.stepSince), today));
}

/** The Monday of `today`'s week, at local midnight. */
export function weekStart(today = new Date()): Date {
  const d = startOfDay(today);
  // getDay(): 0 is Sunday. The panel's week runs Monday to Sunday.
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

export function weekEnd(today = new Date()): Date {
  const d = weekStart(today);
  d.setDate(d.getDate() + 6);
  return d;
}

/**
 * Which group a task belongs to.
 *
 * A completed task is `closed` whatever its dates say: finished work never
 * appears under Overdue, which is the difference between a list that reports
 * and a list that nags.
 */
export function groupOf(task: TaskResponse, today = new Date()): GroupKey {
  if (task.status === 'DONE') return 'closed';
  if (!task.dueDate) return 'noDates';
  const delta = daysBetween(today, parseDay(task.dueDate));
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  // Everything else still open and dated. See groupTasks for why there is no
  // sixth group for what falls past Sunday.
  return 'week';
}

/**
 * The tasks of each group, in the order they are read.
 *
 * Note what "this week" holds: everything still open that is due after today.
 * A task due in three weeks has to live somewhere, and burying it under a
 * sixth group nobody scrolls to would hide work that is coming; the group's
 * note names the Sunday so the boundary is not a secret.
 *
 * Within a group the order is the server's — due date, then priority — so
 * paging never reshuffles what is already on screen.
 */
export function groupTasks(tasks: TaskResponse[], today = new Date()): Record<GroupKey, TaskResponse[]> {
  const out: Record<GroupKey, TaskResponse[]> = { overdue: [], today: [], week: [], noDates: [], closed: [] };
  for (const task of tasks) out[groupOf(task, today)].push(task);
  return out;
}

/** Whether a group with nothing in it still draws its header and its grey line. */
export function showsWhenEmpty(group: GroupKey): boolean {
  return ALWAYS_SHOWN.includes(group);
}

/** The step a row's button offers. Null on a completed task: the ladder ends there. */
export function stepAfter(status: TaskStatus): TaskStatus | null {
  const order: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
  const i = order.indexOf(status);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

/** Two letters for an avatar: "Aníbal Pérez" → "AP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
