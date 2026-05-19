import {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain
} from 'electron';

import path from 'node:path';
import { execFile } from 'node:child_process';
import started from 'electron-squirrel-startup';

if (started) app.quit();

// ===============================
// GLOBAL STATE
// ===============================

let mainWindow = null;

let gameIsActive = false;
let pendingActivation = false;
let gameFocusInterval = null;
let overlayBoundsInterval = null;
let hudVisible = false;
let isRebinding = false;

const GAME_ACTIVATION_DELAY = 1000;

let currentToggleHudHotkey = 'F6';

let guideHotkeys = {
  menuUp: 'Up',
  menuDown: 'Down',
  enter: 'Return',
  escape: 'Esc',
  exit: 'F3',
  zoomImage: 'F2'
};

// ===============================
// GAME DETECTION
// ===============================

const allowedGameExecutables = [
  'cod24-cod'
];

function isGameProcessRunning(callback) {
  const processList = allowedGameExecutables
    .map((name) => `"${name}"`)
    .join(',');

  const script = `
    $names = @(${processList})

    $found = Get-Process | Where-Object {
      $names -contains $_.ProcessName
    } | Select-Object -First 1

    if ($found) {
      $found.ProcessName
    }
  `;

  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ],
    (error, stdout) => {
      if (error) {
        callback('');
        return;
      }

      callback(stdout.trim());
    }
  );
}

function checkGameActive() {
  isGameProcessRunning((processName) => {
    const isGame = Boolean(processName);

    if (isGame && !gameIsActive && !pendingActivation) {
      pendingActivation = true;

      setTimeout(() => {
        isGameProcessRunning((confirmedProcess) => {
          if (!confirmedProcess) {
            pendingActivation = false;
            return;
          }

          pendingActivation = false;
          activateOverlay();
        });
      }, GAME_ACTIVATION_DELAY);

      return;
    }

    if (!isGame && gameIsActive) {
      pendingActivation = false;
      deactivateOverlay();
    }
  });
}

// ===============================
// WINDOW
// ===============================

function getGameWindowBounds(callback) {
  const script = `
    Add-Type @"
    using System;
    using System.Text;
    using System.Runtime.InteropServices;

    public class Win32 {
      public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

      [DllImport("user32.dll")]
      public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

      [DllImport("user32.dll")]
      public static extern bool IsWindowVisible(IntPtr hWnd);

      [DllImport("user32.dll")]
      public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

      [DllImport("user32.dll")]
      public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

      [DllImport("user32.dll")]
      public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

      public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
      }
    }
"@

    $best = $null
    $bestArea = 0

    [Win32]::EnumWindows({
      param($hWnd, $lParam)

      if (-not [Win32]::IsWindowVisible($hWnd)) {
        return $true
      }

      $titleBuilder = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hWnd, $titleBuilder, 256) | Out-Null
      $title = $titleBuilder.ToString()

      $pid = 0
      [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

      if (-not $proc) {
        return $true
      }

      $isCod =
        $proc.ProcessName -eq "cod24-cod" -or
        $proc.ProcessName -eq "Call of Duty" -or
        $title -like "*Call of Duty*"

      if (-not $isCod) {
        return $true
      }

      $rect = New-Object Win32+RECT
      [Win32]::GetWindowRect($hWnd, [ref]$rect) | Out-Null

      $w = $rect.Right - $rect.Left
      $h = $rect.Bottom - $rect.Top
      $area = $w * $h

      if ($w -gt 300 -and $h -gt 300 -and $area -gt $bestArea) {
        $script:bestArea = $area
        $script:best = "$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
      }

      return $true
    }, [IntPtr]::Zero) | Out-Null

    if ($best) {
      $best
    }
  `;

  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ],
    (error, stdout) => {
      if (error || !stdout.trim()) {
        callback(null);
        return;
      }

      const [left, top, right, bottom] = stdout
        .trim()
        .split(',')
        .map(Number);

      callback({
        left,
        top,
        right,
        bottom
      });
    }
  );
}

function updateOverlayBoundsToGame() {
  if (!mainWindow || !gameIsActive) return;

  getGameWindowBounds((rect) => {
    if (!rect) return;

    const gameWidth = rect.right - rect.left;
    const gameHeight = rect.bottom - rect.top;

    const overlayWidth = Math.min(
      430,
      Math.floor(gameWidth * 0.35)
    );

    mainWindow.setBounds(
      {
        x: rect.right - overlayWidth,
        y: rect.top,
        width: overlayWidth,
        height: gameHeight
      },
      true
    );
  });
}

function getOverlayBounds() {
  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const overlayWidth = 430;

  return {
    width: overlayWidth,
    height: bounds.height,
    x: bounds.x + bounds.width - overlayWidth,
    y: bounds.y
  };
}

function getOverlayBoundsFromGame(callback) {
  const processList = allowedGameExecutables
    .map((name) => `"${name}"`)
    .join(',');

  const script = `
    $names = @(${processList})

    Add-Type @"
    using System;
    using System.Text;
    using System.Runtime.InteropServices;

    public class Win32 {
      public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

      [DllImport("user32.dll")]
      public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

      [DllImport("user32.dll")]
      public static extern bool IsWindowVisible(IntPtr hWnd);

      [DllImport("user32.dll")]
      public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

      [DllImport("user32.dll")]
      public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

      [DllImport("user32.dll")]
      public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

      public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
      }
    }
"@

    $targetHandle = [IntPtr]::Zero

    [Win32]::EnumWindows({
      param($hWnd, $lParam)

      if (-not [Win32]::IsWindowVisible($hWnd)) {
        return $true
      }

      $pid = 0
      [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null

      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

      if ($proc -and ($names -contains $proc.ProcessName)) {
        $script:targetHandle = $hWnd
        return $false
      }

      return $true
    }, [IntPtr]::Zero) | Out-Null

    if ($targetHandle -ne [IntPtr]::Zero) {
      $rect = New-Object Win32+RECT
      [Win32]::GetWindowRect($targetHandle, [ref]$rect) | Out-Null

      "$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
    }
  `;

  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ],
    (error, stdout) => {
      if (error || !stdout.trim()) {
        return;
      }

      const [left, top, right, bottom] = stdout
        .trim()
        .split(',')
        .map(Number);

      const gameWidth = right - left;
      const gameHeight = bottom - top;

      if (gameWidth <= 0 || gameHeight <= 0) {
        return;
      }

      const overlayWidth = Math.min(
        430,
        Math.floor(gameWidth * 0.35)
      );

      callback({
        width: overlayWidth,
        height: gameHeight,
        x: right - overlayWidth,
        y: top
      });
    }
  );
}

function createWindow() {
  const bounds = getOverlayBounds();

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
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

  mainWindow.hide();
}

// ===============================
// OVERLAY VISIBILITY
// ===============================

function activateOverlay() {
  gameIsActive = true;
  hudVisible = true;

  mainWindow.showInactive();

  setTimeout(() => {
    updateOverlayBoundsToGame();
  }, 1000);

  registerToggleHudHotkey(
    currentToggleHudHotkey
  );

  registerGuideHotkeys();
}

function deactivateOverlay() {
  gameIsActive = false;
  hudVisible = false;

  pendingActivation = false;

  unregisterGuideHotkeys();

  globalShortcut.unregister(
    currentToggleHudHotkey
  );

  if (overlayBoundsInterval) {
    clearInterval(
      overlayBoundsInterval
    );

    overlayBoundsInterval = null;
  }

  mainWindow.hide();
}

function toggleHud() {
  if (!gameIsActive) return;

  hudVisible = !hudVisible;

  if (hudVisible) {
    mainWindow.showInactive();

    mainWindow.webContents.send(
      'hud-visibility',
      'show'
    );

    registerGuideHotkeys();

    return;
  }

  mainWindow.webContents.send(
    'hud-visibility',
    'hide'
  );

  unregisterGuideHotkeys();

  setTimeout(() => {
    if (!hudVisible) {
      mainWindow.hide();
    }
  }, 180);
}

// ===============================
// HOTKEYS
// ===============================

function registerShortcutSafe(key, action) {
  if (!key) return;

  globalShortcut.unregister(key);

  const success = globalShortcut.register(key, () => {
    if (
      !hudVisible ||
      !gameIsActive ||
      isRebinding
    ) {
      return;
    }

    mainWindow.webContents.send('guide-action', action);
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

function registerToggleHudHotkey(key = 'F6') {
  globalShortcut.unregister(currentToggleHudHotkey);

  const success = globalShortcut.register(key, () => {
    if (!gameIsActive) return;

    toggleHud();
  });

  if (success) {
    currentToggleHudHotkey = key;
  }
}

function updateGuideHotkey(action, key) {
  unregisterGuideHotkeys();

  if (action === 'previous') {
    guideHotkeys.menuUp = key;
  }

  if (action === 'complete') {
    guideHotkeys.menuDown = key;
  }

  if (action === 'exit' || action === 'zoomImage') {
    guideHotkeys[action] = key;
  }

  if (hudVisible && gameIsActive) {
    registerGuideHotkeys();
  }
}

function syncGuideHotkeys() {
  unregisterGuideHotkeys();

  if (
    gameIsActive &&
    hudVisible &&
    !isRebinding
  ) {
    registerGuideHotkeys();
  }
}

// ===============================
// IPC
// ===============================

ipcMain.on('set-click-through', (_, value) => {
  mainWindow.setIgnoreMouseEvents(value, {
    forward: true
  });
});

ipcMain.on('set-rebinding', (_, value) => {
    isRebinding = value;
    syncGuideHotkeys();
});

ipcMain.on('update-hotkey', (_, action, key) => {
  if (action === 'toggleHud') {
    registerToggleHudHotkey(key);
    return;
  }

  updateGuideHotkey(action, key);
});

// ===============================
// APP LIFECYCLE
// ===============================

app.whenReady().then(() => {
  createWindow();

  setInterval(checkGameActive,1000);
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});