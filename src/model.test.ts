import { describe, expect, it } from 'vitest';
import { active, addMonths, amountAt, changeAmount, forecast, parseMoney, validateBudget, type Budget, type Entry } from './model';
const entry = (patch: Partial<Entry> = {}): Entry => ({ id: '1', accountId: 'main', kind: 'expense', name: 'Ноутбук', category: 'Покупки', amount: 30000, frequency: 'monthly', start: '2026-10', end: '', changes: [], overrides: {}, ...patch });
const budget = (entries: Entry[]): Budget => ({ version: 3, startMonth: '2026-10', accounts: [{ id: 'main', name: 'Main', currency: 'PLN', opening: 800000 }], entries, transfers: [] });
describe('monthly cash flow', () => {
  it('carries balances and stops installments after the inclusive end month', () => {
    const rows = forecast(budget([entry({ id: 'salary', kind: 'income', amount: 520000 }), entry({ id: 'living', amount: 380000 }), entry({ end: '2026-11' })]), 3);
    expect(rows.map(r => r.closing)).toEqual([910000, 1020000, 1160000]);
    expect(rows[1].opening).toBe(rows[0].closing);
  });
  it('counts one-off payments exactly once and not before their start', () => {
    expect(forecast(budget([entry({ frequency: 'once', start: '2026-11' })]), 4).map(r => r.expense)).toEqual([0, 30000, 0, 0]);
  });
  it('preserves deficits instead of clipping them', () => {
    expect(forecast({ ...budget([entry({ amount: 100000 })]), accounts: [{ id: 'main', name: 'Main', currency: 'PLN', opening: 0 }] }, 3).map(r => r.closing)).toEqual([-100000, -200000, -300000]);
  });
  it('uses integer minor units without floating-point accumulation', () => {
    expect(forecast({ ...budget([entry({ amount: 10 })]), accounts: [{ id: 'main', name: 'Main', currency: 'PLN', opening: 1000 }] }, 12).at(-1)?.closing).toBe(880);
  });
  it('crosses year boundaries without date drift', () => {
    expect(addMonths('2026-12', 2)).toBe('2027-02');
    expect(addMonths('2028-01', 2)).toBe('2028-03');
  });
  it('does not activate an override outside the entry lifetime', () => {
    const e = entry({ end: '2026-11', overrides: { '2026-12': 12000 } });
    expect(amountAt(e, '2026-12')).toBe(0);
    expect(active(e, '2026-11')).toBe(true);
  });
  it('applies a single-month change then restores the recurring value', () => {
    const e = changeAmount(entry(), '2026-11', 0, 'month');
    expect(forecast(budget([e]), 3).map(m => m.expense)).toEqual([30000, 0, 30000]);
  });
  it('future edits preserve the past and replace subsequent changes', () => {
    const e = entry({ overrides: { '2026-10': 20000, '2027-01': 90000 }, changes: [{ from: '2026-12', amount: 60000 }] });
    const changed = changeAmount(e, '2026-11', 40000, 'future');
    expect(forecast(budget([changed]), 4).map(m => m.expense)).toEqual([20000, 40000, 40000, 40000]);
    expect(e.changes).toHaveLength(1);
  });
  it('single-month overrides take priority over future changes', () => {
    const e = entry({ changes: [{ from: '2026-10', amount: 40000 }], overrides: { '2026-11': 100 } });
    expect(amountAt(e, '2026-11')).toBe(100);
  });
});
describe('input and backups', () => {
  it('parses commas, spaces, negative opening balances and exact cents', () => {
    expect(parseMoney('1 234,56')).toBe(123456);
    expect(parseMoney('-0.01', true)).toBe(-1);
    expect(parseMoney('0,10')).toBe(10);
  });
  it.each(['-5', '1.001', 'Infinity', '1e3', '', '10000001', '1,2,3'])('rejects invalid amounts %s', input => expect(() => parseMoney(input)).toThrow());
  it('round-trips a backup including overrides and future changes', () => {
    const b = budget([entry({ changes: [{ from: '2027-01', amount: 40000 }], overrides: { '2026-11': 0 } })]);
    expect(validateBudget(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it('rejects duplicate identities, malformed months, and noninteger money', () => {
    expect(() => validateBudget(budget([entry(), entry()]))).toThrow();
    expect(() => validateBudget({ ...budget([]), startMonth: '2026-13' })).toThrow();
    expect(() => validateBudget(budget([entry({ amount: 1.2 })]))).toThrow();
    expect(() => validateBudget(budget([entry({ end: '2026-09' })]))).toThrow();
    expect(() => validateBudget({ ...budget([]), version: 99 })).toThrow();
  });
});
