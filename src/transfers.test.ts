import { expect, it } from 'vitest';
import { forecast, validateBudget, type Budget, type Transfer } from './model';
const transfer: Transfer = { id: 'fx', name: 'Exchange', fromAccountId: 'pln', toAccountId: 'eur', spent: 43000, received: 10000, month: '2026-10' };
const budget: Budget = { version: 2, startMonth: '2026-10', accounts: [{ id: 'pln', name: 'PLN', currency: 'PLN', opening: 100000 }, { id: 'eur', name: 'EUR', currency: 'EUR', opening: 0 }], entries: [], transfers: [transfer] };
it('applies both sides once, in their own currencies, and carries balances forward', () => {
  expect(forecast(budget, 3, 'pln').map(m => m.closing)).toEqual([57000, 57000, 57000]);
  expect(forecast(budget, 3, 'eur').map(m => m.closing)).toEqual([10000, 10000, 10000]);
  expect(forecast(budget, 1, 'pln')[0].transferredOut).toBe(43000);
  expect(forecast(budget, 1, 'eur')[0].transferredIn).toBe(10000);
});
it('does not turn an internal transfer into income or expense', () => {
  for (const id of ['pln', 'eur']) {
    const m = forecast(budget, 1, id)[0];
    expect(m.income).toBe(0); expect(m.expense).toBe(0);
  }
});
it('applies future transfers only in their selected month', () => {
  expect(forecast({ ...budget, transfers: [{ ...transfer, month: '2026-11' }] }, 3, 'pln').map(m => m.closing)).toEqual([100000, 57000, 57000]);
});
it('updates both sides on edit, and undoes both sides on deletion', () => {
  const edited = { ...budget, transfers: [{ ...transfer, spent: 86000, received: 20000 }] };
  expect(forecast(edited, 1, 'pln')[0].closing).toBe(14000);
  expect(forecast(edited, 1, 'eur')[0].closing).toBe(20000);
  expect(forecast({ ...budget, transfers: [] }, 1, 'pln')[0].closing).toBe(100000);
  expect(forecast({ ...budget, transfers: [] }, 1, 'eur')[0].closing).toBe(0);
});
it('supports the opposite direction without inventing exchange rates', () => {
  const reverse = { ...budget, transfers: [{ ...transfer, fromAccountId: 'eur', toAccountId: 'pln', spent: 10000, received: 42500 }] };
  expect(forecast(reverse, 1, 'pln')[0].closing).toBe(142500);
  expect(forecast(reverse, 1, 'eur')[0].closing).toBe(-10000);
});
it('round-trips transfers and upgrades earlier backups without transfers', () => {
  expect(validateBudget(JSON.parse(JSON.stringify(budget)))).toEqual(budget);
  const { transfers, ...earlier } = budget;
  expect(validateBudget(earlier).transfers).toEqual([]);
});
it('rejects zero, negative, fractional or missing account legs', () => {
  for (const patch of [{ spent: 0 }, { received: -1 }, { spent: 1.2 }, { toAccountId: 'pln' }, { fromAccountId: 'missing' }]) {
    expect(() => validateBudget({ ...budget, transfers: [{ ...transfer, ...patch }] })).toThrow();
  }
  expect(() => validateBudget({ ...budget, transfers: [transfer, transfer] })).toThrow();
});
it('preserves the combined balance for equal-currency equal-amount transfers', () => {
  const b: Budget = { ...budget, accounts: budget.accounts.map(a => ({ ...a, currency: 'PLN' })), transfers: [{ ...transfer, received: transfer.spent }] };
  expect(forecast(b, 1, 'pln')[0].closing + forecast(b, 1, 'eur')[0].closing).toBe(100000);
});
