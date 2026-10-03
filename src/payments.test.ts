import { describe, expect, it } from 'vitest';
import { forecast, validateBudget, type Budget, type Entry } from './model';
import { dateKey, dueDate, localDate, markSettled, payments, reminderPlan, shiftDays } from './payments';
const entry = (patch: Partial<Entry> = {}): Entry => ({ id: 'rent', accountId: 'main', kind: 'expense', name: 'Rent', category: 'Home', amount: 150000, frequency: 'monthly', start: '2026-10', end: '', changes: [], overrides: {}, dueDay: 15, reminder: { daysBefore: 3, time: '09:00', onDueDate: true }, ...patch });
const budget = (entries = [entry()]): Budget => ({ version: 3, startMonth: '2026-10', accounts: [{ id: 'main', name: 'Main', currency: 'PLN', opening: 900000 }, { id: 'eur', name: 'Euro', currency: 'EUR', opening: 100000 }], entries, transfers: [] });

describe('payment dates and status', () => {
  it('clamps each occurrence independently, including leap years', () => {
    expect(dueDate('2027-02', 31)).toBe('2027-02-28');
    expect(dueDate('2028-02', 31)).toBe('2028-02-29');
    expect(payments(budget([entry({ dueDay: 31 })]), '2027-01-01', '2027-04-30').map(p => p.date)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });
  it('subtracts calendar days across months, years and daylight-saving boundaries', () => {
    expect(shiftDays('2027-01-01', -3)).toBe('2026-12-29');
    expect(shiftDays('2026-03-30', -1)).toBe('2026-03-29');
    expect(localDate(shiftDays('2026-10-26', -1), '09:00').getHours()).toBe(9);
  });
  it('uses actual month overrides and end dates, ignores zero and undated amounts', () => {
    const b = budget([entry({ end: '2026-12', overrides: { '2026-11': 0 }, changes: [{ from: '2026-12', amount: 9900 }] }), entry({ id: 'food', dueDay: undefined, reminder: undefined })]);
    expect(payments(b, '2026-10-01', '2027-01-31').map(p => [p.month, p.amount])).toEqual([['2026-10', 150000], ['2026-12', 9900]]);
  });
  it('keeps account currencies separate and includes one-off income once', () => {
    const b = budget([entry(), entry({ id: 'salary', accountId: 'eur', kind: 'income', reminder: undefined, frequency: 'once' })]);
    expect(payments(b, '2026-10-01', '2026-12-31', 'eur')).toHaveLength(1);
    expect(payments(b, '2026-10-01', '2026-12-31', 'main')).toHaveLength(3);
  });
  it('marks one month paid without changing forecasts; undo restores it', () => {
    const b = budget(), paid = markSettled(b, 'rent', '2026-10', true);
    expect(forecast(paid, 12)).toEqual(forecast(b, 12));
    expect(payments(paid, '2026-10-01', '2026-11-30').map(p => p.settled)).toEqual([true, false]);
    expect(markSettled(paid, 'rent', '2026-10', true).entries[0].settledMonths).toEqual(['2026-10']);
    expect(markSettled(paid, 'rent', '2026-10', false).entries[0].settledMonths).toEqual([]);
    expect(b.entries[0].settledMonths).toBeUndefined();
  });
});
describe('bounded local reminder schedule', () => {
  const now = localDate('2026-10-01', '08:00');
  it('schedules advance and due-day reminders at local time; paid removes both', () => {
    const b = budget([entry({ frequency: 'once' })]);
    const plan = reminderPlan(b, now);
    expect(plan.groups.map(g => [dateKey(g.at), g.at.getHours()])).toEqual([['2026-10-12', 9], ['2026-10-15', 9]]);
    expect(reminderPlan(markSettled(b, 'rent', '2026-10', true), now).groups).toEqual([]);
  });
  it('deduplicates zero-day reminders and groups payments at the same minute', () => {
    const reminder = { daysBefore: 0, time: '09:00', onDueDate: true };
    const plan = reminderPlan(budget([entry({ frequency: 'once', reminder }), entry({ id: 'phone', accountId: 'eur', frequency: 'once', reminder })]), now);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].payments).toHaveLength(2);
    expect(plan.groups[0].id).toBeGreaterThan(0);
  });
  it('does not replay past alerts and respects due-day opt-out', () => {
    const b = budget([entry({ frequency: 'once', reminder: { daysBefore: 3, time: '09:00', onDueDate: false } })]);
    expect(reminderPlan(b, localDate('2026-10-13')).groups).toHaveLength(0);
    expect(reminderPlan(budget([entry({ frequency: 'once' })]), localDate('2026-10-13')).groups.map(g => dateKey(g.at))).toEqual(['2026-10-15']);
  });
  it('includes long-lead reminders for payments beyond the schedule horizon', () => {
    const b = budget([entry({ start: '2028-01', frequency: 'once', reminder: { daysBefore: 365, time: '10:30', onDueDate: false } })]);
    expect(reminderPlan(b, now).groups.map(g => dateKey(g.at))).toEqual(['2027-01-15']);
  });
  it('limits native alarms and reports the actual coverage; ids are stable', () => {
    const b = budget();
    const plan = reminderPlan(b, now, 3);
    expect(plan.groups).toHaveLength(3);
    expect(plan.truncated).toBe(true);
    expect(plan.until).toBe('2026-11-12');
    expect(reminderPlan(b, now, 3)).toEqual(plan);
  });
});
describe('v3 backup compatibility', () => {
  it('migrates v2 without inventing dates or changing money', () => {
    const old = { ...budget([entry({ dueDay: undefined, reminder: undefined })]), version: 2 };
    const next = validateBudget(JSON.parse(JSON.stringify(old)));
    expect(next.version).toBe(3);
    expect(next.entries[0].dueDay).toBeUndefined();
    expect(forecast(next, 12)).toEqual(forecast(budget(old.entries), 12));
  });
  it('round-trips dates, reminders and payment marks', () => {
    const b = markSettled(budget(), 'rent', '2026-10', true);
    expect(validateBudget(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it.each([{ dueDay: 0 }, { dueDay: 32 }, { dueDay: 1.5 }, { dueDay: '15' }, { reminder: { daysBefore: -1, time: '09:00', onDueDate: true } }, { reminder: { daysBefore: 366, time: '09:00', onDueDate: true } }, { reminder: { daysBefore: 1, time: '24:00', onDueDate: true } }, { reminder: { daysBefore: 1, time: '09:00', onDueDate: 'yes' } }, { dueDay: undefined }, { kind: 'income' }, { settledMonths: ['2026-13'] }, { settledMonths: ['2026-10', '2026-10'] }])('rejects malformed schedule data %j', patch => {
    expect(() => validateBudget(budget([{ ...entry(), ...patch } as Entry]))).toThrow();
  });
});
