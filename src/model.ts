import { translate, type Language } from './messages';
export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'UAH', 'RUB', 'CZK', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD'] as const;
export type Currency = typeof CURRENCIES[number];
export const newId = () => crypto.randomUUID();
export type Account = { id: string; name: string; currency: Currency; opening: number };
export type Transfer = { id: string; fromAccountId: string; toAccountId: string; spent: number; received: number; month: string; name: string };
export type Kind = 'income' | 'expense';
export type Entry = {
  id: string; accountId: string; kind: Kind; name: string; category: string; amount: number;
  frequency: 'monthly' | 'once'; start: string; end: string;
  changes: { from: string; amount: number }[];
  overrides: Record<string, number>;
};
export type Budget = { version: 2; startMonth: string; accounts: Account[]; entries: Entry[]; transfers: Transfer[] };
export type Month = { month: string; opening: number; income: number; expense: number; transferredIn: number; transferredOut: number; net: number; closing: number };
export const STORAGE_KEY = 'vpered.budget.v1';
const LIMIT = 1_000_000_000;
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const validMonth = (s: unknown): s is string => typeof s === 'string' && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(s);
export function addMonths(month: string, offset: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const money = (cents: number, language: Language = 'ru') => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'ru-RU', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
export const monthName = (month: string, short = false, language: Language = 'ru') => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'ru-RU', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }).format(new Date(y, m - 1, 1));
};
export function parseMoney(raw: string, signed = false): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!(signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(s)) throw new Error('Введите сумму с точностью до двух знаков после запятой.');
  const negative = s.startsWith('-');
  const [whole, fraction = ''] = s.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > LIMIT) throw new Error('Максимальная сумма — 10 000 000 в валюте счёта.');
  return negative ? -cents : cents;
}
export const emptyBudget = (language: Language = 'ru'): Budget => ({ version: 2, startMonth: currentMonth(), accounts: [{ id: 'main', name: translate(language, 'Основной счёт'), currency: 'PLN', opening: 0 }], entries: [], transfers: [] });
export function active(entry: Entry, month: string) {
  return month >= entry.start && (!entry.end || month <= entry.end) && (entry.frequency === 'monthly' || month === entry.start);
}
export function amountAt(entry: Entry, month: string): number {
  if (!active(entry, month)) return 0;
  if (Object.hasOwn(entry.overrides, month)) return entry.overrides[month];
  let amount = entry.amount;
  for (const change of [...entry.changes].sort((a, b) => a.from.localeCompare(b.from))) {
    if (change.from <= month) amount = change.amount;
  }
  return amount;
}
export function changeAmount(entry: Entry, month: string, amount: number, scope: 'all' | 'month' | 'future'): Entry {
  if (scope === 'all') return { ...entry, amount, changes: [], overrides: {} };
  if (scope === 'month') return { ...entry, overrides: { ...entry.overrides, [month]: amount } };
  return { ...entry, changes: [...entry.changes.filter(c => c.from < month), { from: month, amount }], overrides: Object.fromEntries(Object.entries(entry.overrides).filter(([m]) => m < month)) };
}
export function forecast(budget: Budget, count: number, accountId = budget.accounts[0].id): Month[] {
  const account = budget.accounts.find(a => a.id === accountId);
  if (!account) throw new Error('Счёт не найден.');
  let opening = account.opening;
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(budget.startMonth, i);
    let income = 0, expense = 0;
    for (const e of budget.entries) {
      if (e.accountId !== accountId) continue;
      if (e.kind === 'income') income += amountAt(e, month); else expense += amountAt(e, month);
    }
    let transferredIn = 0, transferredOut = 0;
    for (const transfer of budget.transfers) {
      if (transfer.month !== month) continue;
      if (transfer.fromAccountId === accountId) transferredOut += transfer.spent;
      if (transfer.toAccountId === accountId) transferredIn += transfer.received;
    }
    const net = income - expense + transferredIn - transferredOut, closing = opening + net;
    const result = { month, opening, income, expense, transferredIn, transferredOut, net, closing };
    opening = closing;
    return result;
  });
}
// Explicit validation keeps imported files out of executable paths and bounds calculations.
export function validateBudget(raw: unknown): Budget {
  const fail = () => { throw new Error('Файл не соответствует формату бюджета Вперёд.'); };
  if (!raw || typeof raw !== 'object') return fail();
  const b = raw as Record<string, unknown>;
  const amount = (v: unknown, signed = false): v is number => typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= LIMIT && (signed || v >= 0);
  const label = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 100;
  if (![1, 2].includes(Number(b.version)) || !validMonth(b.startMonth) || b.startMonth > '2099-12' || !Array.isArray(b.entries) || b.entries.length > 1000) return fail();
  const accounts: Account[] = [];
  if (b.version === 1) {
    if (!amount(b.opening, true)) return fail();
    accounts.push({ id: 'main', name: 'Основной счёт', currency: 'PLN', opening: b.opening });
  } else {
    if (b.version !== 2 || !Array.isArray(b.accounts) || b.accounts.length === 0 || b.accounts.length > 50) return fail();
    for (const rawAccount of b.accounts) {
      if (!rawAccount || typeof rawAccount !== 'object') return fail();
      const a = rawAccount as Record<string, unknown>;
      if (!label(a.id) || accounts.some(existing => existing.id === a.id) || !label(a.name) || !CURRENCIES.includes(a.currency as Currency) || !amount(a.opening, true)) return fail();
      accounts.push({ id: a.id, name: a.name.trim(), currency: a.currency as Currency, opening: a.opening });
    }
  }
  const ids = new Set<string>();
  const entries: Entry[] = b.entries.map((rawEntry: unknown) => {
    if (!rawEntry || typeof rawEntry !== 'object') return fail();
    const e = rawEntry as Record<string, unknown>;
    const accountId = b.version === 1 ? 'main' : e.accountId;
    if (typeof accountId !== 'string' || !accounts.some(a => a.id === accountId)) return fail();
    if (!label(e.id) || ids.has(e.id) || !label(e.name) || !label(e.category) || !['income', 'expense'].includes(String(e.kind)) || !amount(e.amount) || !['monthly', 'once'].includes(String(e.frequency)) || !validMonth(e.start) || !(e.end === '' || validMonth(e.end) && e.end >= e.start) || !Array.isArray(e.changes) || e.changes.length > 1200 || !e.overrides || typeof e.overrides !== 'object' || Array.isArray(e.overrides)) return fail();
    ids.add(e.id);
    const dates = new Set<string>();
    const changes = e.changes.map((rawChange: unknown) => {
      if (!rawChange || typeof rawChange !== 'object') return fail();
      const c = rawChange as Record<string, unknown>;
      if (!validMonth(c.from) || dates.has(c.from) || !amount(c.amount)) return fail();
      dates.add(c.from); return { from: c.from, amount: c.amount };
    });
    const overrides: Record<string, number> = {};
    if (Object.keys(e.overrides).length > 1200) return fail();
    for (const [key, value] of Object.entries(e.overrides)) {
      if (!validMonth(key) || !amount(value)) return fail();
      overrides[key] = value;
    }
    return { id: e.id, accountId, name: e.name.trim(), category: e.category.trim(), kind: e.kind as Kind, amount: e.amount, frequency: e.frequency as Entry['frequency'], start: e.start, end: e.end as string, changes, overrides };
  });
  const rawTransfers = b.version === 1 ? [] : b.transfers ?? [];
  if (!Array.isArray(rawTransfers) || rawTransfers.length > 1000) return fail();
  const transferIds = new Set<string>();
  const transfers: Transfer[] = rawTransfers.map(rawTransfer => {
    if (!rawTransfer || typeof rawTransfer !== 'object') return fail();
    const item = rawTransfer as Record<string, unknown>;
    if (!label(item.id) || transferIds.has(item.id) || !label(item.name) || !validMonth(item.month) ||
      typeof item.fromAccountId !== 'string' || typeof item.toAccountId !== 'string' || item.fromAccountId === item.toAccountId ||
      !accounts.some(a => a.id === item.fromAccountId) || !accounts.some(a => a.id === item.toAccountId) ||
      !amount(item.spent) || item.spent <= 0 || !amount(item.received) || item.received <= 0) return fail();
    transferIds.add(item.id);
    return { id: item.id, name: item.name.trim(), month: item.month, fromAccountId: item.fromAccountId, toAccountId: item.toAccountId, spent: item.spent, received: item.received };
  });
  return { version: 2, accounts, startMonth: b.startMonth, entries, transfers };
}
export function demoBudget(language: Language = 'ru'): Budget {
  const start = currentMonth();
  const row = (kind: Kind, name: string, category: string, amount: number, end = ''): Entry => ({ id: crypto.randomUUID(), accountId: 'main', kind, name: translate(language, name), category: translate(language, category), amount: amount * 100, start, end, frequency: 'monthly', changes: [], overrides: {} });
  return { ...emptyBudget(language), startMonth: start, accounts: [{ id: 'main', name: translate(language, 'Основной счёт'), currency: 'PLN', opening: 800000 }], entries: [
    row('income', 'Зарплата', 'Работа', 5200),
    row('expense', 'Квартира и коммунальные', 'Жильё', 2100),
    row('expense', 'Продукты', 'Повседневное', 1100),
    row('expense', 'Транспорт', 'Повседневное', 350),
    row('expense', 'Связь и подписки', 'Сервисы', 250),
    row('expense', 'Рассрочка за ноутбук', 'Покупки', 300, addMonths(start, 1))
  ] };
}
