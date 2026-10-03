import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const native = Capacitor.isNativePlatform();
declare global { interface Window { desktopStorage?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; export: (contents: string, filename: string) => Promise<void> } } }
const desktop = window.desktopStorage;
const values = new Map<string, string>();
let writes = Promise.resolve();
export async function initializeStorage() {
  if (!native && !desktop) return;
  for (const key of ['vpered.budget.v1', 'vpered.language', 'vpered.theme', 'vpered.reminders.enabled', 'vpered.backup.before-v2', 'vpered.backup.before-v3']) {
    const value = desktop ? await desktop.get(key) : (await Preferences.get({ key })).value;
    if (value !== null) values.set(key, value);
  }
}
export const storage = {
  getItem(key: string): string | null { return native || desktop ? values.get(key) ?? null : localStorage.getItem(key); },
  setItem(key: string, value: string): Promise<void> {
    if (!native && !desktop) { try { localStorage.setItem(key, value); return Promise.resolve(); } catch (error) { return Promise.reject(error); } }
    values.set(key, value);
    const write = writes.catch(() => {}).then(() => desktop ? desktop.set(key, value) : Preferences.set({ key, value }));
    writes = write;
    return write;
  }
};
export async function exportBudget(contents: string, filename: string) {
  if (desktop) { await desktop.export(contents, filename); return; }
  if (native) {
    const file = await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ files: [file.uri], title: 'Vpered budget', dialogTitle: 'Save budget file' });
    return;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
