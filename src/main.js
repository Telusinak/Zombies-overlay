import {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain
} from 'electron';

import path from 'node:path';
import started from 'electron-squirrel-startup';

if (started) app.quit();

let mainWindow;
let hudVisible = true;

let currentToggleHudHotkey = 'F6';

let guideHotkeys = {
  previous: 'F7',
  complete: 'F8',
  exit: 'F9',
  zoomImage: 'E',
  menuUp: 'Up',
  menuDown: 'Down'
};

function getGameLikeBounds() {
  const display = screen.getPrimaryDisplay();

  // Para juego en ventana sin bordes, esto normalmente coincide con el área útil.
  return display.bounds;
}

const createWindow = () => {
  const bounds = getGameLikeBounds();

  const overlayWidth = 430;

  mainWindow = new BrowserWindow({
    width: overlayWidth,
    height: bounds.height,
    x: bounds.x + bounds.width - overlayWidth,
    y: bounds.y,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.setIgnoreMouseEvents(true, {
    forward: true
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
      )
    );
  }

  // mainWindow.webContents.openDevTools();
};

function registerGuideHotkeys() {
  unregisterGuideHotkeys();

  globalShortcut.register(guideHotkeys.menuUp, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'menuUp');
    }
  });

  globalShortcut.register(guideHotkeys.menuDown, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'menuDown');
    }
  });

  globalShortcut.register(guideHotkeys.previous, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'previous');
    }
  });

  globalShortcut.register(guideHotkeys.complete, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'complete');
    }
  });

  globalShortcut.register(guideHotkeys.exit, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'exit');
    }
  });

  globalShortcut.register(guideHotkeys.zoomImage, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', 'zoomImage');
    }
  });
}

function unregisterGuideHotkeys() {
  Object.values(guideHotkeys).forEach((key) => {
    globalShortcut.unregister(key);
  });
}

function toggleHud() {
  hudVisible = !hudVisible;

  if (hudVisible) {
    mainWindow.show();
    mainWindow.focus();
    registerGuideHotkeys();
  } else {
    unregisterGuideHotkeys();
    mainWindow.hide();
  }
}

function registerToggleHudHotkey(key = 'F6') {
  globalShortcut.unregister(currentToggleHudHotkey);

  const success = globalShortcut.register(key, toggleHud);

  if (success) {
    currentToggleHudHotkey = key;
  }
}

app.whenReady().then(() => {
  createWindow();

  registerToggleHudHotkey(currentToggleHudHotkey);
  registerGuideHotkeys();
});

ipcMain.on('set-click-through', (_, value) => {
  mainWindow.setIgnoreMouseEvents(value, {
    forward: true
  });
});

ipcMain.on('update-hotkey', (_, action, key) => {
  if (action === 'toggleHud') {
    registerToggleHudHotkey(key);
    return;
  }

  if (
    action === 'previous' ||
    action === 'complete' ||
    action === 'exit' ||
    action === 'zoomImage'
  ) {
    unregisterGuideHotkeys();

    guideHotkeys[action] = key;

    if (hudVisible) {
      registerGuideHotkeys();
    }
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});