import { expect, it } from 'vitest';
import { forecast, validateBudget, money, monthName, type Budget, type Entry } from './model';
import { translate } from './messages';
const e = (id: string, accountId: string, kind: 'income' | 'expense', amount: number): Entry => ({ id, accountId, kind, amount, name: id, category: 'Custom', frequency: 'monthly', start: '2026-10', end: '', changes: [], overrides: {} });
const b: Budget = { version: 2, startMonth: '2026-10', accounts: [{ id: 'pln', name: 'Poland', currency: 'PLN', opening: 10000 }, { id: 'usd', name: 'Dollars', currency: 'USD', opening: 50000 }], transfers: [], entries: [e('salary', 'pln', 'income', 20000), e('rent', 'pln', 'expense', 5000), e('freelance', 'usd', 'income', 30000), e('subscription', 'usd', 'expense', 1000)] };
it('keeps balances, incomes and expenses isolated by account and currency', () => {
  expect(forecast(b, 2, 'pln').map(m => m.closing)).toEqual([25000, 40000]);
  expect(forecast(b, 2, 'usd').map(m => m.closing)).toEqual([79000, 108000]);
  expect(() => forecast(b, 1, 'missing')).toThrow();
});
it('migrates version 1 without changing any amounts', () => {
  const migrated = validateBudget({ version: 1, startMonth: '2026-10', opening: 10000, entries: [e('salary', 'old', 'income', 20000)] });
  expect(migrated.version).toBe(2);
  expect(migrated.accounts).toEqual([{ id: 'main', name: 'Основной счёт', currency: 'PLN', opening: 10000 }]);
  expect(migrated.entries[0].accountId).toBe('main');
  expect(forecast(migrated, 1)[0].closing).toBe(30000);
});
it('round-trips multiple accounts and preserves user-written labels', () => {
  expect(validateBudget(JSON.parse(JSON.stringify(b)))).toEqual(b);
});
it('rejects missing accounts, duplicate accounts and unsupported currencies', () => {
  expect(() => validateBudget({ ...b, accounts: [] })).toThrow();
  expect(() => validateBudget({ ...b, accounts: [b.accounts[0], b.accounts[0]] })).toThrow();
  expect(() => validateBudget({ ...b, accounts: [{ ...b.accounts[0], currency: 'XYZ' }] })).toThrow();
  expect(() => validateBudget({ ...b, entries: [e('bad', 'missing', 'expense', 100)] })).toThrow();
});
it('formats dates, amounts and interpolated messages in English', () => {
  expect(money(123456, 'en')).toBe('1,234.56');
  expect(monthName('2026-10', false, 'en')).toBe('October 2026');
  expect(translate('en', 'Не хватает {0} {1}', '30', 'EUR')).toBe('Shortfall of 30 EUR');
});
