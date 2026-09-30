const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const keys = new Set(['vpered.budget.v1', 'vpered.language', 'vpered.backup.before-v2']);
let data = {}, queue = Promise.resolve();
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const filename = path.join(app.getPath('userData'), 'preferences.json');
    try { data = JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') { dialog.showErrorBox('Vpered', 'Could not read local data. Your original file has been preserved.'); app.quit(); return; } }
    ipcMain.handle('storage-read', (_, key) => { if (!keys.has(key)) throw new Error('Invalid key'); return data[key] ?? null; });
    ipcMain.handle('storage-write', (_, key, value) => {
      if (!keys.has(key) || typeof value !== 'string' || value.length > 2_000_000) throw new Error('Invalid value');
      queue = queue.catch(() => {}).then(async () => {
        const next = { ...data, [key]: value };
        await fs.mkdir(path.dirname(filename), { recursive: true });
        await fs.writeFile(filename + '.tmp', JSON.stringify(next), 'utf8');
        await fs.rename(filename + '.tmp', filename);
        data = next;
      });
      return queue;
    });
    ipcMain.handle('budget-export', async (_, contents, name) => {
      if (typeof contents !== 'string' || contents.length > 2_000_000 || !/^vpered-budget-\d{4}-\d{2}\.json$/.test(name)) throw new Error('Invalid export');
      const result = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: 'Budget JSON', extensions: ['json'] }] });
      if (!result.canceled && result.filePath) await fs.writeFile(result.filePath, contents, 'utf8');
    });
    session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_, callback) => callback({ cancel: true }));
    const window = new BrowserWindow({ width: 1360, height: 930, minWidth: 390, minHeight: 650, backgroundColor: '#f5f7f9', icon: path.join(__dirname, '../public/app-icon.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const entry = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
    window.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== entry) event.preventDefault(); });
    await window.loadURL(entry);
  });
  app.on('window-all-closed', () => app.quit());
}
