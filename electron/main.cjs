const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');

// Hardware acceleration & low-latency gaming flags for Windows
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Default window dimensions: 1280x720 or 85% of screen
    const defaultWidth = Math.min(1440, Math.max(1024, Math.round(screenWidth * 0.85)));
    const defaultHeight = Math.min(900, Math.max(640, Math.round(screenHeight * 0.85)));

    mainWindow = new BrowserWindow({
      title: 'OUTPOST ZERO - Tactical Combat Simulator',
      icon: path.join(__dirname, '../build/icon.png'),
      width: defaultWidth,
      height: defaultHeight,
      minWidth: 960,
      minHeight: 540,
      center: true,
      backgroundColor: '#070b12',
      show: false, // Show once ready-to-show to prevent white flash
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false, // Prevents FPS drop when window loses focus
        webSecurity: true,
        spellcheck: false,
      },
    });

    // Remove default top menu bar
    Menu.setApplicationMenu(null);

    // Development URL vs Production File URL
    const devUrl = process.env.ELECTRON_DEV_URL;
    if (devUrl) {
      mainWindow.loadURL(devUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Handle F11 key for native fullscreen toggle
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F11' && input.type === 'keyDown') {
        const isFullScreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullScreen);
        event.preventDefault();
      }
    });

    mainWindow.on('enter-full-screen', () => {
      mainWindow.webContents.send('window:fullscreen-change', true);
    });

    mainWindow.on('leave-full-screen', () => {
      mainWindow.webContents.send('window:fullscreen-change', false);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // IPC Handlers
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('window:toggle-fullscreen', () => {
    if (mainWindow) {
      const isFullScreen = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFullScreen);
    }
  });

  ipcMain.handle('window:is-fullscreen', () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
  });

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });
}
