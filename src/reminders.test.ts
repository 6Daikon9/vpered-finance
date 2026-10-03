import { beforeEach, expect, it, vi } from 'vitest';
import { emptyBudget, type Entry, type Budget } from './model';
import { localDate } from './payments';
const mocks = vi.hoisted(() => ({ platform: 'android', native: { getPending: vi.fn(), cancel: vi.fn(), removeAllDeliveredNotifications: vi.fn(), checkPermissions: vi.fn(), checkExactNotificationSetting: vi.fn(), createChannel: vi.fn(), schedule: vi.fn() } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks.native }));
import { syncReminders } from './reminders';
const now = localDate('2026-10-01', '08:00');
const row: Entry = { id: 'rent', accountId: 'main', kind: 'expense', name: 'Rent', category: 'Home', amount: 10000, frequency: 'once', start: '2026-10', end: '', changes: [], overrides: {}, dueDay: 15, reminder: { daysBefore: 1, time: '09:00', onDueDate: true } };
const budget = () => ({ ...emptyBudget(), startMonth: '2026-10', entries: [row] });
beforeEach(() => {
  vi.resetAllMocks(); mocks.platform = 'android';
  mocks.native.getPending.mockResolvedValue({ notifications: [{ id: 111 }] });
  mocks.native.checkPermissions.mockResolvedValue({ display: 'granted' });
  mocks.native.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
  mocks.native.schedule.mockResolvedValue({ notifications: [] });
});
it('cancels stale alarms before scheduling edited data in the selected language', async () => {
  const status = await syncReminders(budget(), true, 'en', now);
  expect(status.mode).toBe('ready');
  expect(mocks.native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 111 }] });
  expect(mocks.native.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.native.schedule.mock.invocationCallOrder[0]);
  expect(mocks.native.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ title: 'Payment reminder', body: 'Rent: 100 PLN · 15/10/2026', isExactNotification: true });
});
it('cancels without scheduling when disabled, deleted, paid or without saved data', async () => {
  for (const [b, enabled] of [[budget(), false], [{ ...budget(), entries: [] }, true], [{ ...budget(), entries: [{ ...row, settledMonths: ['2026-10'] }] }, true], [null, true]] as [Budget | null, boolean][]) await syncReminders(b, enabled, 'ru', now);
  expect(mocks.native.cancel).toHaveBeenCalledTimes(4);
  expect(mocks.native.schedule).not.toHaveBeenCalled();
});
it('does not claim success when OS permissions are blocked or scheduling fails', async () => {
  mocks.native.checkPermissions.mockResolvedValueOnce({ display: 'denied' });
  expect((await syncReminders(budget(), true, 'ru', now)).mode).toBe('blocked');
  mocks.native.schedule.mockRejectedValueOnce(new Error('OS rejected schedule'));
  await expect(syncReminders(budget(), true, 'ru', now)).rejects.toThrow('OS rejected');
  expect((await syncReminders(budget(), true, 'ru', now)).mode).toBe('ready');
});
it('uses inexact delivery when exact alarm access is absent', async () => {
  mocks.native.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' });
  expect((await syncReminders(budget(), true, 'ru', now)).exact).toBe(false);
  expect(mocks.native.schedule.mock.calls[0][0].notifications.every((n: { isExactNotification: boolean }) => !n.isExactNotification)).toBe(true);
});
it('serializes rapid edits so disabling notifications wins', async () => {
  const first = syncReminders(budget(), true, 'ru', now);
  const last = syncReminders(budget(), false, 'ru', now);
  await first; expect((await last).mode).toBe('off');
  expect(mocks.native.cancel.mock.invocationCallOrder[1]).toBeGreaterThan(mocks.native.schedule.mock.invocationCallOrder[0]);
});
it('never calls mobile APIs on desktop', async () => {
  mocks.platform = 'web';
  expect((await syncReminders(budget(), true, 'ru', now)).mode).toBe('desktop');
  expect(mocks.native.getPending).not.toHaveBeenCalled();
});
