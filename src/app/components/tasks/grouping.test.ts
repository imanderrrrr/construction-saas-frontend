// The five urgency groups replaced four kanban columns, so the grouping rules
// are the section. They are pure functions for exactly this reason: the group
// a row lands in must never disagree with the counter above it.

import { describe, expect, it } from 'vitest';
import type { TaskResponse } from '../../services/tasks';
import { daysInStep, daysLate, groupOf, groupTasks, showsWhenEmpty, stepAfter, weekEnd, weekStart } from './grouping';

/** Monday 7 September 2026, the day every board of the design sheet is drawn on. */
const MONDAY = new Date(2026, 8, 7, 9, 0, 0);

function task(over: Partial<TaskResponse> & { id: number }): TaskResponse {
  return {
    projectId: 1, projectName: 'Torre Zona 14', title: 'Tarea', description: null,
    status: 'TODO', priority: 'MEDIUM', assignedToId: null, assignedToName: null,
    startDate: null, dueDate: null, sortOrder: 0, createdById: 1, createdByName: 'Ander',
    createdAt: '2026-08-25T07:55:00Z', updatedAt: '2026-08-25T07:55:00Z',
    ...over,
  };
}

describe('grouping', () => {
  it('puts each task in the group its due date says', () => {
    expect(groupOf(task({ id: 1, dueDate: '2026-09-05' }), MONDAY)).toBe('overdue');
    expect(groupOf(task({ id: 2, dueDate: '2026-09-07' }), MONDAY)).toBe('today');
    expect(groupOf(task({ id: 3, dueDate: '2026-09-11' }), MONDAY)).toBe('week');
    expect(groupOf(task({ id: 4 }), MONDAY)).toBe('noDates');
  });

  it('never files finished work as overdue, whatever its dates say', () => {
    // The difference between a list that reports and a list that nags.
    expect(groupOf(task({ id: 5, status: 'DONE', dueDate: '2026-08-01' }), MONDAY)).toBe('closed');
  });

  it('draws Overdue and Due today even at zero, and hides the other three', () => {
    // Their emptiness is the answer to the question that brings anyone here.
    expect(showsWhenEmpty('overdue')).toBe(true);
    expect(showsWhenEmpty('today')).toBe(true);
    expect(showsWhenEmpty('week')).toBe(false);
    expect(showsWhenEmpty('noDates')).toBe(false);
    expect(showsWhenEmpty('closed')).toBe(false);
  });

  it('runs the week from Monday to Sunday', () => {
    expect(weekStart(MONDAY).getDate()).toBe(7);
    expect(weekEnd(MONDAY).getDate()).toBe(13);
    // And from a Sunday, the week is the one that ends that day.
    const sunday = new Date(2026, 8, 13, 22, 0, 0);
    expect(weekStart(sunday).getDate()).toBe(7);
    expect(weekEnd(sunday).getDate()).toBe(13);
  });

  it('counts days late on the calendar, not in hours', () => {
    // Whatever the time of day, 5 September is two days before the 7th.
    expect(daysLate(task({ id: 1, dueDate: '2026-09-05' }), MONDAY)).toBe(2);
    expect(daysLate(task({ id: 2, dueDate: '2026-09-04' }), MONDAY)).toBe(3);
    expect(daysLate(task({ id: 3, dueDate: '2026-09-07' }), MONDAY)).toBeNull();
    expect(daysLate(task({ id: 4, dueDate: '2026-09-30' }), MONDAY)).toBeNull();
    expect(daysLate(task({ id: 5 }), MONDAY)).toBeNull();
  });

  it('never confuses days late with days in the step', () => {
    // The two numbers this redesign introduces, and the mistake its concept
    // review caught: a task 2 days late that has sat 7 days in review.
    const t = task({ id: 1, status: 'REVIEW', dueDate: '2026-09-05', stepSince: '2026-08-31T17:20:00Z' });
    expect(daysLate(t, MONDAY)).toBe(2);
    expect(daysInStep(t, MONDAY)).toBe(7);
  });

  it('has no age when the server did not send the mark', () => {
    // Never guessed from `updatedAt`: that also moves when someone edits a title.
    expect(daysInStep(task({ id: 1 }), MONDAY)).toBeNull();
  });

  it('groups a whole list at once, keeping the server order inside each group', () => {
    const groups = groupTasks([
      task({ id: 1, dueDate: '2026-09-05' }),
      task({ id: 2, dueDate: '2026-09-07' }),
      task({ id: 3, dueDate: '2026-09-04' }),
      task({ id: 4 }),
      task({ id: 5, status: 'DONE' }),
      task({ id: 6, dueDate: '2026-09-11' }),
    ], MONDAY);

    expect(groups.overdue.map(t => t.id)).toEqual([1, 3]);
    expect(groups.today.map(t => t.id)).toEqual([2]);
    expect(groups.week.map(t => t.id)).toEqual([6]);
    expect(groups.noDates.map(t => t.id)).toEqual([4]);
    expect(groups.closed.map(t => t.id)).toEqual([5]);
  });

  it('keeps everything dated and open in a group, including what falls past Sunday', () => {
    // There is no sixth group for the far future: work that is coming has to
    // be somewhere, and the group's own note names the Sunday.
    expect(groupOf(task({ id: 1, dueDate: '2026-10-30' }), MONDAY)).toBe('week');
  });

  it('names the next rung, and stops at the last one', () => {
    expect(stepAfter('TODO')).toBe('IN_PROGRESS');
    expect(stepAfter('IN_PROGRESS')).toBe('REVIEW');
    expect(stepAfter('REVIEW')).toBe('DONE');
    // Completed is the end of the line: the server has no endpoint back.
    expect(stepAfter('DONE')).toBeNull();
  });
});
