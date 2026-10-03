import { useEffect, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { type Budget } from './model';
import { useI18n } from './i18n';
import { dateKey, localDate, markSettled, payments, shiftDays } from './payments';
import { exactReminderSettings, isAndroid, requestReminderPermission, syncReminders, testReminder, type ReminderStatus } from './reminders';
import { storage } from './storage';
import './payments.css';

export function PaymentPanel({ budget, savedBudget, accountId, month, onChange }: { budget: Budget; savedBudget: Budget | null; accountId: string; month: string; onChange: (budget: Budget) => boolean }) {
  const { t, language, money } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState('next');
  const [limit, setLimit] = useState(30);
  const [enabled, setEnabled] = useState(() => { try { return storage.getItem('vpered.reminders.enabled') === 'true'; } catch { return false; } });
  const [status, setStatus] = useState<ReminderStatus>({ mode: isAndroid() ? 'off' : 'desktop' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  useEffect(() => {
    const refresh = () => { setNow(new Date()); setRevision(r => r + 1); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    const interval = setInterval(() => setNow(new Date()), 60000);
    const native = isAndroid() ? NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) refresh(); }) : null;
    return () => { document.removeEventListener('visibilitychange', visible); clearInterval(interval); if (native) void native.then(h => h.remove()); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void syncReminders(savedBudget, enabled, language).then(result => { if (!cancelled) { setStatus(result); setError(''); } }).catch(() => { if (!cancelled) setError('Не удалось обновить уведомления. Проверьте разрешения и повторите.'); });
    return () => { cancelled = true; };
  }, [savedBudget, enabled, language, revision]);
  useEffect(() => setLimit(30), [view, accountId, month]);
  const today = dateKey(now), tomorrow = shiftDays(today, 1);
  const dateText = (date: string) => new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(localDate(date));
  const from = view === 'month' ? `${month}-01` : view === 'overdue' ? `${budget.startMonth}-01` : today;
  const to = view === 'month' ? `${month}-31` : view === 'overdue' ? shiftDays(today, -1) : shiftDays(today, 30);
  const rows = payments(budget, from, to, accountId).filter(row => view === 'month' || !row.settled);
  const account = budget.accounts.find(a => a.id === accountId)!;
  async function toggleNotifications() {
    setBusy(true); setError('');
    try {
      const next = !enabled;
      if (next && !await requestReminderPermission()) { setError('Уведомления запрещены в настройках Android.'); return; }
      await storage.setItem('vpered.reminders.enabled', String(next)); setEnabled(next);
    } catch { setError('Не удалось обновить уведомления. Проверьте разрешения и повторите.'); }
    finally { setBusy(false); }
  }
  return <section id="payments" className="panel payments-panel">
    <div className="section-title"><div><h2>{t('Платежи по дням')}</h2><p className="payment-caption">{account.name} · {t('Сегодня')}: {dateText(today)}</p></div>
    <select className="payment-view" aria-label={t('Показать платежи')} value={view} onChange={event => setView(event.target.value)}>
      <option value="next">{t('Ближайшие 30 дней')}</option><option value="overdue">{t('Просроченные')}</option><option value="month">{t('Выбранный месяц')}</option>
    </select></div>
    <p className="payment-caption payment-intro">{t('Укажите день месяца в доходе или расходе. Отметка оплаты не меняет месячный прогноз и не списывает деньги повторно.')}</p>
    <div className="payment-list">{rows.length === 0 ? <p className="payment-empty">{t('В этом периоде нет платежей с датой.')}</p> : rows.slice(0, limit).map(row => <div className={`payment-row ${row.settled ? 'settled' : ''}`} key={row.key}>
      <div className="payment-description"><strong>{row.entry.name}</strong><span>{row.entry.category} · {dateText(row.date)}</span><small className={!row.settled && row.date < today ? 'negative' : ''}>{row.settled ? t(row.entry.kind === 'income' ? 'Получено' : 'Оплачено') : row.date < today ? t(row.entry.kind === 'income' ? 'Доход не подтверждён' : 'Просрочено') : row.date === today ? t('Сегодня') : row.date === tomorrow ? t('Завтра') : t('Запланировано')}</small></div>
      <strong className={row.entry.kind === 'income' ? 'positive' : ''}>{row.entry.kind === 'income' ? '+' : '−'}{money(row.amount)} <small>{account.currency}</small></strong>
      <button type="button" className="button secondary" aria-label={t(row.settled ? 'Отменить отметку: {0}' : row.entry.kind === 'income' ? 'Получено: {0}' : 'Оплачено: {0}', row.entry.name)} onClick={() => onChange(markSettled(budget, row.entry.id, row.month, !row.settled))}>{t(row.settled ? 'Отменить отметку' : row.entry.kind === 'income' ? 'Получено' : 'Оплачено')}</button>
    </div>)}</div>
    {rows.length > limit && <button className="text-button payment-more" onClick={() => setLimit(n => n + 30)}>{t('Показать ещё')}</button>}
    <div className="reminder-settings"><strong>{t('Напоминания')}</strong>
      {isAndroid() ? <><p>{t('Расписание хранится на телефоне и работает без интернета. Включение действует для всех счетов.')}</p>
        <button className="button secondary" disabled={busy} onClick={() => void toggleNotifications()}>{t(enabled ? 'Выключить уведомления' : 'Включить уведомления')}</button>
        {enabled && <button className="text-button" disabled={busy} onClick={() => { setTestSent(false); void testReminder(language).then(() => setTestSent(true)).catch(() => setError('Не удалось обновить уведомления. Проверьте разрешения и повторите.')); }}>{t('Проверить уведомление')}</button>}
        {testSent && <p role="status">{t('Проверочное уведомление запланировано через 10 секунд. Android может задержать доставку.')}</p>}
        {enabled && status.mode === 'blocked' && <p className="error">{t('Уведомления запрещены в настройках Android.')}</p>}
        {enabled && status.mode === 'ready' && <><p role="status">{t('Запланировано уведомлений: {0}. Расписание до {1}.', status.count ?? 0, dateText(status.until!))}</p>
          {status.truncated && <p>{t('Показаны ближайшие 256 уведомлений. Открывайте приложение для продления расписания.')}</p>}
          {!status.exact && <><p>{t('Точное время не разрешено: Android может доставить уведомление позже выбранного времени.')}</p><button className="text-button" onClick={() => void exactReminderSettings().then(() => setRevision(r => r + 1)).catch(() => setError('Не удалось обновить уведомления. Проверьте разрешения и повторите.'))}>{t('Настроить точное время')}</button></>}
          <p>{t('Открывайте приложение хотя бы раз в год для продления расписания, а также после смены часового пояса. Ограничения батареи и принудительная остановка могут задерживать уведомления.')}</p></>}
        <button className="text-button" onClick={() => setRevision(r => r + 1)}>{t('Обновить расписание')}</button>
      </> : <p>{t('На Windows платежи видны здесь при открытии приложения. Фоновые уведомления доступны в Android-версии.')}</p>}
      {error && <p role="alert" className="error">{t(error)}</p>}
    </div>
  </section>;
}
