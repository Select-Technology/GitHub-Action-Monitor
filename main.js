const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
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

// IPC handler for folder picker
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select local repository folder'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// IPC handler for git pull
ipcMain.handle('git-pull', async (event, folderPath) => {
  return new Promise((resolve) => {
    execFile('git', ['pull'], { cwd: folderPath }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
