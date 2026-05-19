import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // ===============================
  // WINDOW / OVERLAY
  // ===============================

  setClickThrough: (value) => {
    ipcRenderer.send('set-click-through', value);
  },

  onHudVisibility: (callback) => {
    ipcRenderer.on('hud-visibility', (_, value) => {
      callback(value);
    });
  },

  // ===============================
  // GUIDE ACTIONS
  // ===============================

  onGuideAction: (callback) => {
    ipcRenderer.on('guide-action', (_, action) => {
      callback(action);
    });
  },

  // ===============================
  // HOTKEYS / REBINDING
  // ===============================

  updateHotkey: (action, key) => {
    ipcRenderer.send('update-hotkey', action, key);
  },

  setRebinding: (value) => {
    ipcRenderer.send('set-rebinding', value);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);