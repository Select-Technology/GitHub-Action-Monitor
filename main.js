const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');

// Set a consistent userData path so localStorage persists
app.setPath('userData', path.join(app.getPath('appData'), 'GitHubActionsMonitor'));

const autoLauncher = new AutoLaunch({
  name: 'GitHub Actions Monitor',
  path: app.getPath('exe')
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

// Enable auto-launch by default on first run
app.whenReady().then(async () => {
  // Enable auto-launch if not in dev mode
  if (app.isPackaged) {
    const isEnabled = await autoLauncher.isEnabled();
    if (!isEnabled) {
      await autoLauncher.enable();
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC handlers for auto-launch toggle from renderer
ipcMain.handle('get-auto-launch', async () => {
  if (!app.isPackaged) return false;
  return await autoLauncher.isEnabled();
});

ipcMain.handle('set-auto-launch', async (event, enabled) => {
  if (!app.isPackaged) return false;
  if (enabled) {
    await autoLauncher.enable();
  } else {
    await autoLauncher.disable();
  }
  return enabled;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
