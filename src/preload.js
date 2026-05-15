import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setClickThrough: (value) => {
    ipcRenderer.send('set-click-through', value);
  },

  onHudVisibility: (callback) => {
    ipcRenderer.on('hud-visibility', (_, value) => callback(value));
  },

  onGuideAction: (callback) => {
    ipcRenderer.on('guide-action', (_, action) => callback(action));
  },

  updateHotkey: (action, key) => {
    ipcRenderer.send('update-hotkey', action, key);
  }
});