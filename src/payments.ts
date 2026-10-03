import { active, addMonths, amountAt, type Budget, type Entry } from './model';

export type Payment = { key: string; entry: Entry; month: string; date: string; amount: number; settled: boolean };
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localDate = (date: string, time = '12:00') => {
  const [y, m, d] = date.split('-').map(Number), [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};
export function dueDate(month: string, day: number) {
  const [y, m] = month.split('-').map(Number);
  return dateKey(new Date(y, m - 1, Math.min(day, new Date(y, m, 0).getDate()), 12));
}
export function shiftDays(date: string, days: number) {
  const result = localDate(date); result.setDate(result.getDate() + days); return dateKey(result);
}
export function payments(budget: Budget, from: string, to: string, accountId?: string): Payment[] {
  const rows: Payment[] = [];
  for (let month = from.slice(0, 7) > budget.startMonth ? from.slice(0, 7) : budget.startMonth; month <= to.slice(0, 7); month = addMonths(month, 1)) {
    for (const entry of budget.entries) {
      if (!entry.dueDay || (accountId && entry.accountId !== accountId) || !active(entry, month)) continue;
      const date = dueDate(month, entry.dueDay), amount = amountAt(entry, month);
      if (date < from || date > to || amount === 0) continue;
      rows.push({ key: `${entry.id}:${month}`, entry, month, date, amount, settled: entry.settledMonths?.includes(month) ?? false });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
export function markSettled(budget: Budget, entryId: string, month: string, settled: boolean): Budget {
  return { ...budget, entries: budget.entries.map(entry => entry.id === entryId ? {
    ...entry, settledMonths: [...new Set([...(entry.settledMonths ?? []).filter(m => m !== month), ...(settled ? [month] : [])])].sort()
  } : entry) };
}
export type ReminderGroup = { id: number; at: Date; payments: Payment[] };
// One notification per minute avoids alarms competing when several bills share a time.
export function reminderPlan(budget: Budget, now: Date, limit = 256) {
  const until = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59);
  const candidates = payments(budget, dateKey(now), shiftDays(dateKey(until), 365));
  const groups = new Map<string, { at: Date; payments: Payment[] }>();
  for (const payment of candidates) {
    const reminder = payment.entry.reminder;
    if (!reminder || payment.settled || payment.entry.kind !== 'expense') continue;
    for (const offset of new Set([reminder.daysBefore, ...(reminder.onDueDate ? [0] : [])])) {
      const day = shiftDays(payment.date, -offset), at = localDate(day, reminder.time);
      if (at <= now || at > until) continue;
      const key = `${dateKey(at)}T${reminder.time}`;
      const group = groups.get(key) ?? { at, payments: [] };
      group.payments.push(payment); groups.set(key, group);
    }
  }
  const ids = new Set<number>();
  const all: ReminderGroup[] = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
    let id = 2166136261;
    for (const c of key) id = Math.imul(id ^ c.charCodeAt(0), 16777619);
    id = (id >>> 0) % 2147483646 + 1;
    while (ids.has(id)) id = id % 2147483646 + 1;
    ids.add(id); return { id, ...group };
  });
  const selected = all.slice(0, limit);
  return { groups: selected, truncated: all.length > limit, until: all.length > limit ? dateKey(selected.at(-1)!.at) : dateKey(until) };
}
