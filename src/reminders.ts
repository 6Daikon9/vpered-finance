import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderPlan } from './payments';
import { money, type Budget } from './model';
import { translate, type Language } from './messages';

export const isAndroid = () => Capacitor.getPlatform() === 'android';
export type ReminderStatus = { mode: 'desktop' | 'off' | 'blocked' | 'ready'; exact?: boolean; until?: string; count?: number; truncated?: boolean };
let queue: Promise<unknown> = Promise.resolve();
export function syncReminders(budget: Budget | null, enabled: boolean, language: Language, now = new Date()): Promise<ReminderStatus> {
  const task = queue.catch(() => {}).then(async (): Promise<ReminderStatus> => {
    if (!isAndroid()) return { mode: 'desktop' };
    // Replacement is serialized, so an older edit cannot restore cancelled alarms.
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);
    await LocalNotifications.removeAllDeliveredNotifications();
    if (!enabled || !budget) return { mode: 'off' };
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return { mode: 'blocked' };
    const exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    await LocalNotifications.createChannel({ id: 'payments', name: translate(language, 'Платежи'), importance: 4, visibility: 0 });
    const plan = reminderPlan(budget, now);
    if (plan.groups.length) await LocalNotifications.schedule({ notifications: plan.groups.map(group => ({
      id: group.id, title: translate(language, 'Напоминание об оплате'), channelId: 'payments',
      smallIcon: 'ic_stat_payment',
      body: group.payments.slice(0, 4).map(payment => {
        const account = budget.accounts.find(a => a.id === payment.entry.accountId)!;
        const date = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'ru-RU').format(new Date(payment.date + 'T12:00:00'));
        return `${payment.entry.name}: ${money(payment.amount, language)} ${account.currency} · ${date}`;
      }).join('\n') + (group.payments.length > 4 ? `\n+${group.payments.length - 4}` : ''),
      schedule: { at: group.at, allowWhileIdle: true }, isExactNotification: exact,
    })) });
    return { mode: 'ready', exact, until: plan.until, count: plan.groups.length, truncated: plan.truncated };
  });
  queue = task; return task;
}
export async function requestReminderPermission() {
  return isAndroid() && (await LocalNotifications.requestPermissions()).display === 'granted';
}
export async function exactReminderSettings() {
  if (isAndroid()) await LocalNotifications.changeExactNotificationSetting();
}
export async function testReminder(language: Language) {
  if (!await requestReminderPermission()) throw new Error('permission');
  await LocalNotifications.createChannel({ id: 'payments', name: translate(language, 'Платежи'), importance: 4, visibility: 0 });
  await LocalNotifications.schedule({ notifications: [{ id: 2147483647, title: 'Вперёд / Vpered', body: translate(language, 'Проверка напоминаний'), channelId: 'payments', smallIcon: 'ic_stat_payment', isExactNotification: false, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
}
