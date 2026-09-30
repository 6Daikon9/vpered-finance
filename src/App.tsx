import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Download, FileUp, FolderOpen, Landmark, Laptop, Moon, Sun, LayoutDashboard, Pencil, Plus, ShieldCheck, Sparkles, Trash2, Wallet, X } from 'lucide-react';
import { active, addMonths, amountAt, changeAmount, currentMonth, demoBudget, emptyBudget, forecast, parseMoney, STORAGE_KEY, validMonth, validateBudget, CURRENCIES, newId, type Transfer, type Account, type Currency, type Budget, type Entry, type Kind, type Month } from './model';
import { useI18n } from './i18n';
import { storage, exportBudget } from './storage';
import { useTheme } from './theme';
function load() {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        return { budget: raw ? validateBudget(JSON.parse(raw)) : emptyBudget(storage.getItem('vpered.language') === 'en' ? 'en' : 'ru'), error: '' };
    }
    catch {
        return { budget: emptyBudget(), error: 'Не удалось прочитать сохранённый бюджет. Исходная запись сохранена. Загрузите резервную копию или сохраните новый расчёт, чтобы заменить её.' };
    }
}
function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old; }; }, []);
    return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={onClose} onClick={e => { if (e.target === ref.current)
        onClose(); }}>
    <header className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label={t("Закрыть")}><X size={20}/></button></header>{children}
  </dialog>;
}
function EntryForm({ entry, kind, month, categories, account, onSave, onClose }: {
    entry?: Entry;
    kind: Kind;
    month: string;
    categories: string[];
    account: Account;
    onSave: (entry: Entry) => void;
    onClose: () => void;
}) {
    const { t, monthName } = useI18n();
    const currency = account.currency;
    const [scope, setScope] = useState<'all' | 'month' | 'future'>('all');
    const [name, setName] = useState(entry?.name ?? '');
    const [category, setCategory] = useState(entry?.category ?? '');
    const [amount, setAmount] = useState(String((entry?.amount ?? 0) / 100));
    const [frequency, setFrequency] = useState<Entry['frequency']>(entry?.frequency ?? 'monthly');
    const [start, setStart] = useState(entry?.start ?? month);
    const [end, setEnd] = useState(entry?.end ?? '');
    const [error, setError] = useState('');
    const submit = (e: FormEvent) => {
        e.preventDefault();
        try {
            const cents = parseMoney(amount);
            if (entry && scope !== 'all') {
                onSave(changeAmount(entry, month, cents, scope));
                return;
            }
            if (!name.trim() || !category.trim())
                throw new Error(t("Укажите название и категорию."));
            if (!validMonth(start) || (frequency === 'monthly' && end && (!validMonth(end) || end < start)))
                throw new Error(t("Последний месяц не может быть раньше первого."));
            const result: Entry = { id: entry?.id ?? newId(), accountId: account.id, kind, name: name.trim(), category: category.trim(), amount: cents, frequency, start, end: frequency === 'once' ? '' : end, changes: [], overrides: {} };
            onSave(result);
        }
        catch (e) {
            setError((e as Error).message);
        }
    };
    return <Modal title={entry ? t("Изменить статью") : kind === 'income' ? t("Добавить доход") : t("Добавить расход")} onClose={onClose}>
    <form onSubmit={submit} className="entry-form">
      <p className="entry-account">{account.name} <strong>{currency}</strong><span>{t("Валюта суммы определяется счётом.")}</span></p>
      {entry?.frequency === 'monthly' && <label>{t("Применить изменение")}<select aria-label={t("Применить изменение")} value={scope} onChange={e => { const s = e.target.value as typeof scope; setScope(s); setAmount(String((s === 'all' ? entry.amount : amountAt(entry, month)) / 100)); }}>
        <option value="all">{t("Для всего срока")}</option><option value="month" disabled={!active(entry, month)}>{t("Только")} {monthName(month)}</option><option value="future" disabled={!active(entry, month)}>{t("С")} {monthName(month)} {t("и далее")}</option>
      </select></label>}
      {scope === 'all' && <><label>{t("Название")}<input required autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'income' ? t("Например, зарплата") : t("Например, продукты")}/></label>
        <label>{t("Категория")}<input required maxLength={100} list="categories" value={category} onChange={e => setCategory(e.target.value)} placeholder={t("Выберите или впишите свою")}/><datalist id="categories">{categories.map(c => <option key={c} value={c}/>)}</datalist></label></>}
      <label>{t("Сумма")} {currency}<input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} aria-describedby="amount-help"/></label>
      <p id="amount-help" className="field-help">{scope === 'month' ? t("Укажите 0, чтобы пропустить платёж в этом месяце.") : t("До двух знаков после запятой.")}</p>
      {scope === 'all' && <><label>{t("Повторение")}<select aria-label={t("Повторение")} value={frequency} onChange={e => setFrequency(e.target.value as Entry['frequency'])}><option value="monthly">{t("Каждый месяц")}</option><option value="once">{t("Один раз")}</option></select></label>
        <div className="form-columns"><label>{frequency === 'once' ? t("Месяц") : t("Первый месяц")}<input required type="month" min="2000-01" max="2099-12" value={start} onChange={e => setStart(e.target.value)}/></label>
        {frequency === 'monthly' && <label>{t("Последний месяц")}<input type="month" min={start} max="2100-12" value={end} onChange={e => setEnd(e.target.value)}/><span className="field-help">{t("Необязательно, включительно")}</span></label>}</div></>}
      {entry && scope === 'all' && (entry.changes.length > 0 || Object.keys(entry.overrides).length > 0) && <p className="warning">{t("Изменение для всего срока заменит все индивидуальные суммы этой статьи.")}</p>}
      {scope === 'future' && <p className="field-help">{t("Предыдущие месяцы сохранятся. Последующие изменения суммы будут заменены.")}</p>}
      {error && <p className="error" role="alert">{t(error)}</p>}
      <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>{t("Отмена")}</button><button className="button primary" type="submit">{entry ? t("Сохранить изменения") : t("Добавить")}</button></footer>
    </form>
  </Modal>;
}
function Chart({ months, selected, currency, onSelect }: {
    months: Month[];
    currency: Currency;
    selected: string;
    onSelect: (m: string) => void;
}) {
    const { t, money, monthName } = useI18n();
    const width = 860, height = 210, left = 65, right = 22, top = 25, bottom = 38;
    const values = months.map(m => m.closing);
    const min = Math.min(0, ...values), max = Math.max(10000, ...values), range = max - min || 1;
    const x = (i: number) => left + i * (width - left - right) / Math.max(1, months.length - 1);
    const y = (v: number) => top + (max - v) / range * (height - top - bottom);
    const points = months.map((m, i) => `${x(i)},${y(m.closing)}`).join(' ');
    return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Прогноз остатка на конец каждого месяца. Точные суммы приведены в таблице ниже.")}>
    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#76ba94" stopOpacity=".2"/><stop offset="100%" stopColor="#76ba94" stopOpacity=".015"/></linearGradient></defs>
    {[0, 0.5, 1].map(t => { const v = min + range * t; return <g key={t}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="4 5"/><text x={left - 12} y={y(v) + 4} textAnchor="end" className="chart-label">{money(Math.round(v / 10000) * 10000)}</text></g>; })}
    {min < 0 && <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#c96655" strokeDasharray="4 5"/>}
    <polygon points={`${x(0)},${y(min)} ${points} ${x(months.length - 1)},${y(min)}`} fill="url(#area)"/>
    <polyline points={points} fill="none" stroke="#34765f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {months.map((m, i) => <g key={m.month}><circle cx={x(i)} cy={y(m.closing)} r={m.month === selected ? 6 : 3.5} fill={m.closing < 0 ? '#c45746' : '#34765f'} stroke="white" strokeWidth="2"><title>{monthName(m.month)}: {money(m.closing)} {currency}</title></circle></g>)}
  </svg><div className="chart-months" aria-label={t("Выбрать месяц")}>{months.map(m => <button key={m.month} className={selected === m.month ? 'selected' : ''} onClick={() => onSelect(m.month)} aria-label={t("Выбрать {0}", monthName(m.month))} aria-pressed={selected === m.month}>{monthName(m.month, true)}</button>)}</div></div>;
}
export default function App() {
    const { t, language, setLanguage, money, monthName } = useI18n();
    const { theme, toggleTheme, themeError } = useTheme();
    const [initial] = useState(load);
    const [budget, setBudget] = useState(initial.budget);
    const [accountId, setAccountId] = useState(initial.budget.accounts[0].id);
    const account = budget.accounts.find(a => a.id === accountId) ?? budget.accounts[0];
    const currency = account.currency;
    const accountEntries = budget.entries.filter(e => e.accountId === account.id);
    const [transferEditor, setTransferEditor] = useState<{ transfer?: Transfer } | null>(null);
    const [transferToRemove, setTransferToRemove] = useState<Transfer | null>(null);
    const [accountEditor, setAccountEditor] = useState<{ account?: Account } | null>(null);
    const [accountToRemove, setAccountToRemove] = useState<Account | null>(null);
    const [notice, setNotice] = useState(initial.error);
    const [saveError, setSaveError] = useState(false);
    const [stale, setStale] = useState(false);
    const [horizon, setHorizon] = useState(12);
    const [selected, setSelected] = useState(budget.startMonth);
    const [openingText, setOpeningText] = useState(String(account.opening / 100));
    const [editor, setEditor] = useState<{
        kind: Kind;
        entry?: Entry;
    } | null>(null);
    const [remove, setRemove] = useState<Entry | null>(null);
    const [pending, setPending] = useState<{
        budget: Budget;
        title: string;
        description: string;
    } | null>(null);
    const [help, setHelp] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const months = forecast(budget, horizon, account.id);
    useEffect(() => { setOpeningText(String(account.opening / 100)); }, [account.id, account.opening]);
    const current = months.find(m => m.month === selected) ?? months[0];
    const index = months.indexOf(current);
    const last = months.at(-1)!;
    const deficit = months.find(m => m.closing < 0);
    useEffect(() => { const listener = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null)
        setStale(true); }; window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener); }, []);
    function commit(next: Budget) {
        if (stale) {
            setNotice(t("Бюджет изменён в другой вкладке. Обновите страницу перед редактированием."));
            return false;
        }
        try {
            next = validateBudget(next);
        }
        catch (e) {
            setNotice((e as Error).message);
            return false;
        }
        try {
            const previous = storage.getItem(STORAGE_KEY);
            if (previous) { try { if (JSON.parse(previous).version === 1 && !storage.getItem('vpered.backup.before-v2')) void storage.setItem('vpered.backup.before-v2', previous).catch(() => {}); } catch { /* Preserve the existing recovery workflow. */ } }
            void storage.setItem(STORAGE_KEY, JSON.stringify(next)).then(() => setSaveError(false)).catch(() => setSaveError(true));
        }
        catch {
            setSaveError(true);
        }
        setBudget(next);
        setNotice('');
        return true;
    }
    function replace(next: Budget) { if (commit(next)) {
        setSelected(next.startMonth);
        setAccountId(next.accounts[0].id);
        setOpeningText(String(next.accounts[0].opening / 100));
        setPending(null);
    } }
    function saveEntry(entry: Entry) {
        const exists = budget.entries.some(e => e.id === entry.id);
        if (commit({ ...budget, entries: exists ? budget.entries.map(e => e.id === entry.id ? entry : e) : [...budget.entries, entry] }))
            setEditor(null);
    }
    function saveOpening() {
        try {
            const opening = parseMoney(openingText, true);
            if (opening !== account.opening)
                commit({ ...budget, accounts: budget.accounts.map(a => a.id === account.id ? { ...a, opening } : a) });
        }
        catch (e) {
            setNotice((e as Error).message);
        }
    }
    function download() {
        void exportBudget(JSON.stringify(budget, null, 2), `vpered-budget-${currentMonth()}.json`).catch(() => setNotice(t('Не удалось сохранить файл.')));
    }
    async function importFile(file?: File) {
        if (!file)
            return;
        try {
            if (file.size > 2000000)
                throw new Error(t("Файл слишком большой. Максимум — 2 МБ."));
            const imported = validateBudget(JSON.parse(await file.text()));
            setPending({ budget: imported, title: t("Загрузить бюджет?"), description: t("В файле {0} счетов и {1} статей. Начало — {2}. Текущий расчёт будет заменён. Сначала можно сохранить его копию.", imported.accounts.length, imported.entries.length, monthName(imported.startMonth)) });
        }
        catch (e) {
            setNotice(e instanceof SyntaxError ? t("Не удалось прочитать JSON. Выберите файл, сохранённый из калькулятора.") : (e as Error).message);
        }
        if (importRef.current)
            importRef.current.value = '';
    }
    useEffect(() => {
        const context = (document as Document & {
            modelContext?: {
                registerTool: (tool: unknown, options: {
                    signal: AbortSignal;
                }) => Promise<void> | void;
            };
        }).modelContext;
        if (!context?.registerTool)
            return;
        const lifecycle = new AbortController();
        try {
            void Promise.resolve(context.registerTool({ name: 'read_budget_forecast', description: 'Read the selected account forecast. Amounts are integer minor units of its currency. Does not modify data.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: (input: unknown) => { if (!input || typeof input !== 'object' || Object.keys(input).length)
                    throw new Error('Expected an empty object'); return { accountId: account.id, currency, unit: 'minor', months: forecast(budget, horizon, account.id) }; } }, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { /* Optional browser capability. */ }
        return () => lifecycle.abort();
    }, [budget, horizon, account.id, currency]);
    const categories = (kind: Kind) => [...new Set([...(kind === "income" ? [t("Работа"), t("Подработка")] : [t("Жильё"), t("Продукты"), t("Транспорт"), t("Подписки"), t("Покупки"), t("Здоровье"), t("Отдых")]), ...budget.entries.filter(e => e.kind === kind).map(e => e.category)])];
    const list = (kind: Kind) => {
        const entries = accountEntries.filter(e => e.kind === kind);
        return <section className={`panel entries ${kind}`}><div className="section-title"><h2><span className={`section-icon ${kind}`}>{kind === 'income' ? <ArrowDownLeft size={19}/> : <ArrowUpRight size={19}/>}</span>{kind === 'income' ? t("Доходы") : t("Расходы")}<span className="count">{entries.length}</span></h2><button className="small-add" onClick={() => setEditor({ kind })}><Plus size={16}/>{t("Добавить")}</button></div>
      <div className="entry-list">{entries.length === 0 ? <div className="empty"><span>{kind === 'income' ? t("Откуда приходят деньги?") : t("На что планируете тратить?")}</span><p>{kind === 'income' ? t("Добавьте зарплату, подработку или другой доход.") : t("Добавьте жильё, продукты и другие расходы.")}</p><button className="text-button" onClick={() => setEditor({ kind })}>{t("Добавить")} {kind === 'income' ? t("первый доход") : t("первый расход")}</button></div> : entries.map(e => {
                const enabled = active(e, current.month), amount = amountAt(e, current.month), custom = Object.hasOwn(e.overrides, current.month) || e.changes.some(c => c.from <= current.month);
                return <div className={`entry-row ${!enabled ? 'inactive' : ''}`} key={e.id}><div className="entry-mark">{kind === 'income' ? <Landmark size={18}/> : e.end ? <Laptop size={18}/> : <Wallet size={18}/>}</div><div className="entry-copy"><strong>{e.name}</strong><span>{e.category}<i>·</i>{!enabled ? e.start > current.month ? t("ещё не начался") : t("завершён") : e.frequency === 'once' ? t("разово") : e.end ? t("до {0} {1}", monthName(e.end, true), e.end.slice(0, 4)) : t("ежемесячно")}{custom && enabled ? t(" · изменено") : ''}</span></div><div className="entry-value">{money(amount)}<small>{currency}</small></div><div className="row-actions"><button className="icon-button" aria-label={t("Изменить: {0}", e.name)} onClick={() => setEditor({ kind, entry: e })}><Pencil size={15}/></button><button className="icon-button delete" aria-label={t("Удалить: {0}", e.name)} onClick={() => setRemove(e)}><Trash2 size={15}/></button></div></div>;
            })}</div><div className="list-total"><span>{t("Итого за")} {monthName(current.month, true)}</span><strong>{money(kind === 'income' ? current.income : current.expense)} <small>{currency}</small></strong></div></section>;
    };
    return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#top"><span className="brand-mark"><BarChart3 size={24}/></span>{t("вперёд")}<span className="brand-dot">.</span></a><div className="sidebar-label">{t("ЛИЧНЫЙ БЮДЖЕТ")}</div><nav><a className="nav-active" href="#top"><LayoutDashboard size={19}/>{t("Калькулятор")}</a><a href="#entries"><Wallet size={19}/>{t("Доходы и расходы")}</a><a href="#forecast"><CalendarDays size={19}/>{t("Прогноз по месяцам")}</a></nav><div className="sidebar-bottom"><div className="local-note"><ShieldCheck size={21}/><div><strong>{t("На устройстве")}</strong><p>{t("Ваши данные остаются")}<br />{t("В этом приложении.")}</p></div></div><button className="sidebar-action" onClick={download}><Download size={18}/>{t("Сохранить файл")}</button><button className="sidebar-action" onClick={() => importRef.current?.click()}><FolderOpen size={18}/>{t("Загрузить файл")}</button><span className="sidebar-foot">{t("Вперёд · Калькулятор бюджета")}</span></div></aside>
    <main id="top"><header className="page-header"><div><div className="eyebrow">{t("ПЛАНИРОВАНИЕ ФИНАНСОВ")}</div><h1>{t("Бюджет и прогноз")}</h1><p>{t("Доходы, расходы и деньги, которые останутся.")}</p></div><div className="header-actions"><button type="button" className="icon-button theme-toggle" aria-label={t("Тёмная тема")} aria-pressed={theme === "dark"} title={t(theme === "dark" ? "Светлая тема" : "Тёмная тема")} onClick={toggleTheme}>{theme === "dark" ? <Sun size={20}/> : <Moon size={20}/>}</button><select className="language-select" aria-label="Language / Язык" value={language} onChange={e => setLanguage(e.target.value as "ru" | "en")}><option value="ru">RU · Русский</option><option value="en">EN · English</option></select><span className="local-badge"><ShieldCheck size={15}/>{saveError ? t("Не сохранено") : t("Локальный расчёт")}</span><button className="icon-button help-button" aria-label={t("Как пользоваться")} onClick={() => setHelp(true)}><CircleHelp size={21}/></button></div></header>
      <input type="file" accept=".json,application/json" hidden ref={importRef} onChange={e => void importFile(e.target.files?.[0])}/>
      {themeError && <div role="alert" className="notice error">{t("Не удалось сохранить тему. Попробуйте переключить её ещё раз.")}</div>}
      {stale && <div role="alert" className="notice warning">{t("Данные изменены в другой вкладке.")} <button className="text-button" onClick={() => location.reload()}>{t("Обновить страницу")}</button></div>}
      {notice && <div role="alert" className="notice warning">{t(notice)}<button className="icon-button" aria-label={t("Скрыть сообщение")} onClick={() => setNotice('')}><X size={17}/></button></div>}
      {saveError && <div role="alert" className="notice error">{t("Не удалось сохранить изменения. Сохраните файл перед закрытием приложения.")} <button className="text-button" onClick={download}>{t("Сохранить файл")}</button></div>}
      {isDemo && <div className="demo-note"><Sparkles size={16}/>{t("Вы смотрите пример. Все суммы можно изменить.")}<button className="text-button" onClick={() => setPending({ budget: emptyBudget(language), title: t("Начать свой расчёт?"), description: t("Пример будет заменён пустым бюджетом. Все ваши изменения в примере также будут удалены.") })}>{t("Начать с нуля")}</button></div>}
      <section className="accounts-panel" aria-label={t('Счета')}>
        <div className="accounts-heading"><div><h2>{t('Счета')}</h2><p>{t('Прогноз рассчитывается отдельно для каждого счёта в его валюте.')}</p></div><button className="small-add" onClick={() => setAccountEditor({})}><Plus size={17}/>{t('Добавить счёт')}</button></div>
        <div className="account-tabs">{budget.accounts.map(a => <button key={a.id} aria-pressed={a.id === account.id} onClick={() => setAccountId(a.id)}><span>{a.currency}</span><strong>{a.name}</strong></button>)}</div>
        <div className="account-actions"><span>{account.name} · {currency}</span><button className="text-button" onClick={() => setAccountEditor({ account })}><Pencil size={14}/>{t('Изменить счёт')}</button><button className="icon-button delete" disabled={budget.accounts.length === 1 || budget.transfers.some(tr => tr.fromAccountId === account.id || tr.toAccountId === account.id)} title={t("Удалите связанные переводы перед удалением счёта.")} aria-label={t('Удалить счёт')} onClick={() => setAccountToRemove(account)}><Trash2 size={16}/></button></div>
      </section>
      <section className="setup-panel"><div className="setup-title"><span className="setup-icon"><Wallet size={22}/></span><div><strong>{t("Точка отсчёта")}</strong><span>{t("Сколько денег есть на начало расчёта")}</span></div></div><label className="balance-field">{t("Начальная сумма")}<div className="input-currency"><input aria-label={t("Начальная сумма")} inputMode="decimal" value={openingText} onChange={e => setOpeningText(e.target.value)} onBlur={saveOpening} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/><span>{currency}</span></div></label><label>{t("Начать с месяца")}<input aria-label={t("Начать с месяца")} type="month" min="2000-01" max="2099-12" value={budget.startMonth} onChange={e => { if (validMonth(e.target.value) && commit({ ...budget, startMonth: e.target.value }))
        setSelected(e.target.value); }}/></label></section>
      <div className="month-bar"><div className="month-navigation"><button className="icon-button" disabled={index === 0} aria-label={t("Предыдущий месяц")} onClick={() => setSelected(months[index - 1].month)}><ChevronLeft size={18}/></button><h2>{monthName(current.month)}</h2><button className="icon-button" disabled={index === months.length - 1} aria-label={t("Следующий месяц")} onClick={() => setSelected(months[index + 1].month)}><ChevronRight size={18}/></button></div><span className="muted month-start">{t("На начало месяца")} <strong>{money(current.opening)} {currency}</strong></span></div>
      <section className="metrics" aria-label={t("Итоги выбранного месяца")}><div className="metric"><div className="metric-label">{t("Доходы за месяц")}<span className="metric-icon positive"><ArrowDownLeft size={19}/></span></div><div className="metric-value">{money(current.income)} <small>{currency}</small></div><p>{t("Все запланированные поступления")}</p></div><div className="metric"><div className="metric-label">{t("Расходы за месяц")}<span className="metric-icon expense"><ArrowUpRight size={19}/></span></div><div className="metric-value">{money(current.expense)} <small>{currency}</small></div><p>{t("Регулярные и разовые расходы")}</p></div><div className={`metric result ${current.closing < 0 ? 'negative-result' : ''}`}><div className="metric-label">{t("Останется на конец месяца")}<Wallet size={18}/></div><div className="metric-value">{money(current.closing)} <small>{currency}</small></div><p>{current.closing < 0 ? t("Не хватает {0} {1}", money(-current.closing), currency) : t("{0}{1} {2} за этот месяц", current.net >= 0 ? '+' : '−', money(Math.abs(current.net)), currency)}</p></div></section>
      {budget.entries.length === 0 && <div className="welcome"><div><strong>{t("Начните со своего бюджета")}</strong><p>{t("Укажите начальную сумму и добавьте статьи ниже. Прогноз пересчитается сразу.")}</p></div><button className="button secondary" onClick={() => { setIsDemo(true); setPending({ budget: demoBudget(language), title: t("Посмотреть пример"), description: t("Пример заменит текущий расчёт. Сначала можно сохранить его копию.") }); }}><Sparkles size={16}/>{t("Посмотреть пример")}</button></div>}
      {(current.transferredIn > 0 || current.transferredOut > 0) && <div className="transfer-summary"><span>{t('Входящие переводы')}: <strong>+{money(current.transferredIn)} {currency}</strong></span><span>{t('Исходящие переводы')}: <strong>−{money(current.transferredOut)} {currency}</strong></span></div>}
      <div className="budget-lists" id="entries">{list('income')}{list('expense')}</div>
      <section className="panel transfers-panel"><div className="section-title"><h2>{t('Переводы и обмен')}</h2><button className="small-add" disabled={budget.accounts.length < 2} onClick={() => setTransferEditor({})}><Plus size={16}/>{t('Добавить перевод')}</button></div><p className="transfer-help">{t('Одна запись меняет остатки обоих счетов. Переводы учитываются отдельно от доходов и расходов.')}</p>
        {budget.accounts.length < 2 ? <p className="transfer-empty">{t('Добавьте второй счёт, чтобы учитывать переводы и обмен валют.')}</p> : budget.transfers.filter(tr => tr.month === current.month && [tr.fromAccountId, tr.toAccountId].includes(account.id)).length === 0 ? <p className="transfer-empty">{t('В этом месяце переводов нет.')}</p> :
          <div className="transfer-list">{budget.transfers.filter(tr => tr.month === current.month && [tr.fromAccountId, tr.toAccountId].includes(account.id)).map(tr => {
            const from = budget.accounts.find(a => a.id === tr.fromAccountId)!;
            const to = budget.accounts.find(a => a.id === tr.toAccountId)!;
            return <div key={tr.id} className="transfer-row"><div><strong>{tr.name}</strong><span>{from.name} → {to.name}</span></div><div className="transfer-amounts"><span>−{money(tr.spent)} {from.currency}</span><span className="positive">+{money(tr.received)} {to.currency}</span></div><div className="row-actions"><button className="icon-button" aria-label={t('Редактировать перевод: {0}', tr.name)} onClick={() => setTransferEditor({ transfer: tr })}><Pencil size={16}/></button><button className="icon-button delete" aria-label={t('Удалить перевод: {0}', tr.name)} onClick={() => setTransferToRemove(tr)}><Trash2 size={16}/></button></div></div>;
          })}</div>}
      </section>
      <section className="panel forecast-panel" id="forecast"><div className="section-title forecast-title"><div><div className="eyebrow">{t("ВЗГЛЯД ВПЕРЁД")}</div><h2>{t("Как изменится остаток")}</h2></div><div className="segmented" aria-label={t("Период прогноза")}>{[3, 6, 12].map(n => <button key={n} aria-pressed={horizon === n} className={horizon === n ? 'active' : ''} onClick={() => { setHorizon(n); if (selected > addMonths(budget.startMonth, n - 1))
        setSelected(budget.startMonth); }}>{n} {t("мес.")}</button>)}</div></div><div className="forecast-summary"><div><strong className={current.closing < 0 ? 'negative' : ''}>{money(current.closing)} <small>{currency}</small></strong><span>{t("к концу")} {monthName(current.month)}</span></div><span className="chart-legend"><span />{t("Остаток на конец месяца")}</span></div>
        <Chart currency={currency} months={months} selected={current.month} onSelect={setSelected}/>
        {deficit && <div className="forecast-alert"><CircleHelp size={18}/><span>{t("В месяце «")}{monthName(deficit.month)}{t("» расходы превысят доступные деньги. Не хватает")} <strong>{money(-deficit.closing)} {currency}</strong>.</span></div>}
        {!deficit && accountEntries.some(e => e.kind === 'expense' && e.frequency === 'monthly' && e.end >= budget.startMonth && e.end < last.month) && <div className="forecast-insight"><Sparkles size={17}/><span>{t("В этом периоде заканчиваются регулярные платежи. После последнего месяца они автоматически исключаются из расходов.")}</span></div>}
        <div className="table-wrap"><table><thead><tr><th>{t("Месяц")}</th><th>{t("На начало")}</th><th>{t("Доходы")}</th><th>{t("Расходы")}</th><th>{t("Переводы, нетто")}</th><th>{t("За месяц")}</th><th>{t("На конец")}</th></tr></thead><tbody>{months.map(m => <tr key={m.month} className={m.month === current.month ? 'selected-row' : ''}><th scope="row"><button onClick={() => setSelected(m.month)} aria-label={t("Показать {0}", monthName(m.month))} aria-pressed={m.month === current.month}>{monthName(m.month)}</button></th><td>{money(m.opening)}</td><td className="positive">+{money(m.income)}</td><td>{m.expense ? '−' : ''}{money(m.expense)}</td><td>{m.transferredIn - m.transferredOut > 0 ? "+" : ""}{money(m.transferredIn - m.transferredOut)}</td><td className={m.net < 0 ? 'negative' : 'positive'}>{m.net > 0 ? '+' : ''}{money(m.net)}</td><td className={m.closing < 0 ? 'negative closing' : 'closing'}>{money(m.closing)}</td></tr>)}</tbody></table></div>
        <div className="mobile-months">{months.map(m => <button key={m.month} className={`mobile-month ${m.month === current.month ? 'selected-row' : ''}`} onClick={() => setSelected(m.month)}><span><strong>{monthName(m.month)}</strong><small>{t("Доходы")} {money(m.income)} {t("· расходы")} {money(m.expense)}</small>{(m.transferredIn || m.transferredOut) ? <small>{t("Переводы, нетто")}: {money(m.transferredIn - m.transferredOut)} {currency}</small> : null}</span><strong className={m.closing < 0 ? 'negative' : ''}>{money(m.closing)}<small>{currency} {t("на конец")}</small></strong></button>)}</div>
        <footer className="forecast-foot">{t('Все суммы в {0}. Прогноз основан на введённых данных и не учитывает незапланированные траты.', currency)}</footer></section>
      <footer className="page-footer"><span><ShieldCheck size={15}/>{t("Сохраняется на этом устройстве. Делайте резервные копии.")}</span><div><button onClick={download}><Download size={15}/>{t("Сохранить файл")}</button><button onClick={() => importRef.current?.click()}><FileUp size={15}/>{t("Загрузить")}</button></div></footer>
    </main>
    <nav className="mobile-navigation"><a href="#top"><LayoutDashboard size={20}/>{t("Калькулятор")}</a><a href="#entries"><Wallet size={20}/>{t("Доходы и расходы")}</a><a href="#forecast"><BarChart3 size={20}/>{t("Прогноз по месяцам")}</a></nav>
    {transferEditor && <TransferForm accounts={budget.accounts} accountId={account.id} month={current.month} transfer={transferEditor.transfer} onClose={() => setTransferEditor(null)} onSave={tr => {
      const exists = budget.transfers.some(item => item.id === tr.id);
      if (commit({ ...budget, transfers: exists ? budget.transfers.map(item => item.id === tr.id ? tr : item) : [...budget.transfers, tr] })) { setTransferEditor(null); setAccountId(tr.fromAccountId); }
    }}/>} 
    {transferToRemove && <Modal title={t('Удалить перевод?')} onClose={() => setTransferToRemove(null)}><div className="confirm-body"><p>{t('Перевод «{0}» будет удалён из прогноза обоих счетов.', transferToRemove.name)}</p><footer className="modal-actions"><button className="button secondary" onClick={() => setTransferToRemove(null)}>{t('Отмена')}</button><button className="button danger" onClick={() => { if (commit({ ...budget, transfers: budget.transfers.filter(tr => tr.id !== transferToRemove.id) })) setTransferToRemove(null); }}>{t('Удалить')}</button></footer></div></Modal>}
    {accountEditor && <AccountForm account={accountEditor.account} onClose={() => setAccountEditor(null)} onSave={updated => {
      const accounts = accountEditor.account ? budget.accounts.map(a => a.id === updated.id ? updated : a) : [...budget.accounts, updated];
      if (commit({ ...budget, accounts })) { setAccountId(updated.id); setAccountEditor(null); }
    }}/>} 
    {accountToRemove && <Modal title={t('Удалить счёт?')} onClose={() => setAccountToRemove(null)}><div className="confirm-body"><p>{t('Счёт «{0}» и все его статьи ({1}) будут удалены из расчёта.', accountToRemove.name, budget.entries.filter(e => e.accountId === accountToRemove.id).length)}</p><footer className="modal-actions"><button className="button secondary" onClick={() => setAccountToRemove(null)}>{t('Отмена')}</button><button className="button danger" onClick={() => { if (budget.accounts.length > 1 && !budget.transfers.some(tr => tr.fromAccountId === accountToRemove.id || tr.toAccountId === accountToRemove.id) && commit({ ...budget, accounts: budget.accounts.filter(a => a.id !== accountToRemove.id), entries: budget.entries.filter(e => e.accountId !== accountToRemove.id) })) { setAccountToRemove(null); } }}>{t('Удалить')}</button></footer></div></Modal>}
    {editor && <EntryForm account={account} key={editor.entry?.id ?? editor.kind} entry={editor.entry} kind={editor.kind} month={current.month} categories={categories(editor.kind)} onSave={saveEntry} onClose={() => setEditor(null)}/>}
    {remove && <Modal title={t("Удалить статью?")} onClose={() => setRemove(null)}><div className="confirm-body"><p>«{remove.name}{t("» будет удалена из всех месяцев вместе с изменениями сумм.")}</p><footer className="modal-actions"><button className="button secondary" onClick={() => setRemove(null)}>{t("Отмена")}</button><button className="button danger" onClick={() => { if (commit({ ...budget, entries: budget.entries.filter(e => e.id !== remove.id) }))
        setRemove(null); }}>{t("Удалить")}</button></footer></div></Modal>}
    {pending && <Modal title={pending.title} onClose={() => setPending(null)}><div className="confirm-body"><p>{pending.description}</p><button className="text-button" onClick={download}><Download size={16}/>{t("Сохранить текущий расчёт")}</button><footer className="modal-actions"><button className="button secondary" onClick={() => setPending(null)}>{t("Отмена")}</button><button className="button primary" onClick={() => { setIsDemo(false); replace(pending.budget); }}>{t("Заменить расчёт")}</button></footer></div></Modal>}
    {help && <Modal title={t("Как пользоваться")} onClose={() => setHelp(false)}><div className="help-content"><ol><li>{t("Укажите деньги на начало первого месяца расчёта.")}</li><li>{t("Добавьте доходы и расходы. Для каждой статьи можно вписать свою категорию.")}</li><li>{t("Укажите последний месяц для рассрочки или выберите разовый платёж.")}</li><li>{t("Выбирайте месяц в прогнозе. Через карандаш можно изменить сумму только для него или на будущее.")}</li></ol><p className="formula">{t("На конец = на начало + доходы − расходы + входящие переводы − исходящие переводы")}</p><p>{t("Начальная сумма относится к началу месяца: учитывайте полные доходы и расходы этого месяца. Калькулятор не отслеживает отдельные покупки и даты внутри месяца.")}</p><p>{t("Данные хранятся локально. Для переноса на другое устройство сохраните и загрузите файл. Экспорт не зашифрован. Удаление приложения удаляет его данные.")}</p><button className="button primary" onClick={() => setHelp(false)}><Check size={17}/>{t("Понятно")}</button></div></Modal>}
  </div>;
}

function AccountForm({ account, onClose, onSave }: { account?: Account; onClose: () => void; onSave: (a: Account) => void }) {
  const { t, language } = useI18n();
  const [name, setName] = useState(account?.name ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'PLN');
  const [opening, setOpening] = useState(String((account?.opening ?? 0) / 100));
  const [error, setError] = useState('');
  const currencyNames = new Intl.DisplayNames([language === 'en' ? 'en' : 'ru'], { type: 'currency' });
  return <Modal title={t(account ? 'Изменить счёт' : 'Добавить счёт')} onClose={onClose}><form className="entry-form" onSubmit={event => {
    event.preventDefault();
    try {
      if (!name.trim()) throw new Error('Назовите счёт.');
      onSave({ id: account?.id ?? newId(), name: name.trim(), currency, opening: parseMoney(opening, true) });
    } catch (e) { setError((e as Error).message); }
  }}>
    <label>{t('Название счёта')}<input required autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={t('Например, наличные')}/></label>
    <label>{t('Валюта счёта')}<select aria-label={t('Валюта счёта')} disabled={!!account} value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{CURRENCIES.map(code => <option key={code} value={code}>{code} · {currencyNames.of(code)}</option>)}</select></label>
    {account && <p className="field-help">{t('Валюта фиксируется при создании счёта. Для другой валюты добавьте новый счёт.')}</p>}
    <label>{t('Начальная сумма')}, {currency}<input aria-label={t('Начальная сумма')} required inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)}/></label>
    {error && <p className="error" role="alert">{t(error)}</p>}
    <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>{t('Отмена')}</button><button type="submit" className="button primary">{t('Сохранить')}</button></footer>
  </form></Modal>;
}

function TransferForm({ accounts, accountId, month, transfer, onClose, onSave }: { accounts: Account[]; accountId: string; month: string; transfer?: Transfer; onClose: () => void; onSave: (transfer: Transfer) => void }) {
  const { t, language } = useI18n();
  const [fromId, setFromId] = useState(transfer?.fromAccountId ?? accountId);
  const [toId, setToId] = useState(transfer?.toAccountId ?? accounts.find(a => a.id !== accountId)!.id);
  const [spent, setSpent] = useState(transfer ? String(transfer.spent / 100) : '');
  const [received, setReceived] = useState(transfer ? String(transfer.received / 100) : '');
  const [date, setDate] = useState(transfer?.month ?? month);
  const [name, setName] = useState(transfer?.name ?? t('Обмен валют'));
  const [error, setError] = useState('');
  const from = accounts.find(a => a.id === fromId)!;
  const to = accounts.find(a => a.id === toId)!;
  let rate: number | null = null;
  try { const a = parseMoney(spent), b = parseMoney(received); if (a > 0 && b > 0) rate = b / a; } catch { /* Incomplete input is not a rate. */ }
  const formatRate = (n: number) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'ru-RU', { maximumSignificantDigits: 8 }).format(n);
  return <Modal title={t(transfer ? 'Изменить перевод' : 'Добавить перевод')} onClose={onClose}><form className="entry-form" onSubmit={event => {
    event.preventDefault();
    try {
      if (fromId === toId) throw new Error('Выберите два разных счёта.');
      const a = parseMoney(spent), b = parseMoney(received);
      if (a <= 0 || b <= 0) throw new Error('Обе суммы должны быть больше нуля.');
      onSave({ id: transfer?.id ?? newId(), name: name.trim() || t('Обмен валют'), fromAccountId: fromId, toAccountId: toId, spent: a, received: b, month: date });
    } catch (e) { setError((e as Error).message); }
  }}>
    <label>{t('Описание перевода')}<input maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
    <div className="form-columns"><label>{t('Со счёта')}<select aria-label={t('Со счёта')} value={fromId} onChange={e => { setFromId(e.target.value); setSpent(''); }}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label><label>{t('На счёт')}<select aria-label={t('На счёт')} value={toId} onChange={e => { setToId(e.target.value); setReceived(''); }}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label></div>
    <button type="button" className="text-button swap-button" onClick={() => { setFromId(toId); setToId(fromId); setSpent(received); setReceived(spent); }}>{t('Поменять направление')}</button>
    <div className="form-columns"><label>{t('Списано')}, {from.currency}<input aria-label={t('Списано')} required inputMode="decimal" value={spent} onChange={e => setSpent(e.target.value)}/></label><label>{t('Получено')}, {to.currency}<input aria-label={t('Получено')} required inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)}/></label></div>
    <p className="field-help">{t('Укажите обе суммы. Курс рассчитывается по введённым значениям.')}</p>
    {rate !== null && <div className="exchange-rate"><strong>{t('Курс по вашим суммам')}</strong><span>1 {from.currency} ≈ {formatRate(rate)} {to.currency}</span><span>1 {to.currency} ≈ {formatRate(1/rate)} {from.currency}</span><small>{t('Это расчёт по указанным суммам, а не рыночный курс.')}</small></div>}
    <label>{t('Месяц')}<input type="month" required min="2000-01" max="2100-12" value={date} onChange={e => setDate(e.target.value)}/></label>
    {error && <p className="error" role="alert">{t(error)}</p>}
    <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>{t('Отмена')}</button><button type="submit" className="button primary">{t('Сохранить')}</button></footer>
  </form></Modal>;
}
