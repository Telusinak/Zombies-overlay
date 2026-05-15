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
  menuUp: 'Up',
  menuDown: 'Down',
  enter: 'Return',
  escape: 'Esc',
  exit: 'F9',
  zoomImage: 'E'
};

function getGameLikeBounds() {
  const display = screen.getPrimaryDisplay();
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

function registerShortcutSafe(key, action) {
  if (!key) return;

  globalShortcut.unregister(key);

  const success = globalShortcut.register(key, () => {
    if (hudVisible) {
      mainWindow.webContents.send('guide-action', action);
    }
  });

  if (!success) {
    console.warn(`No se pudo registrar shortcut: ${key}`);
  }
}

function registerGuideHotkeys() {
  unregisterGuideHotkeys();

  registerShortcutSafe(guideHotkeys.menuUp, 'menuUp');
  registerShortcutSafe(guideHotkeys.menuDown, 'menuDown');

  registerShortcutSafe(guideHotkeys.enter, 'enter');
  registerShortcutSafe(guideHotkeys.escape, 'escape');

  registerShortcutSafe(guideHotkeys.exit, 'exit');
  registerShortcutSafe(guideHotkeys.zoomImage, 'zoomImage');
}

function unregisterGuideHotkeys() {
  Object.values(guideHotkeys).forEach((key) => {
    if (key) {
      globalShortcut.unregister(key);
    }
  });
}

function toggleHud() {
  hudVisible = !hudVisible;

  if (hudVisible) {
    mainWindow.show();
    mainWindow.focus();

    mainWindow.webContents.send('hud-visibility', 'show');

    registerGuideHotkeys();
  } else {
    mainWindow.webContents.send('hud-visibility', 'hide');

    unregisterGuideHotkeys();

    setTimeout(() => {
      mainWindow.hide();
    }, 180);
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

  if (action === 'previous') {
    unregisterGuideHotkeys();
    guideHotkeys.menuUp = key;

    if (hudVisible) {
      registerGuideHotkeys();
    }

    return;
  }

  if (action === 'complete') {
    unregisterGuideHotkeys();
    guideHotkeys.menuDown = key;

    if (hudVisible) {
      registerGuideHotkeys();
    }

    return;
  }

  if (action === 'exit' || action === 'zoomImage') {
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