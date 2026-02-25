'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  window: {
    minimize: ()  => ipcRenderer.send('window:minimize'),
    maximize: ()  => ipcRenderer.send('window:maximize'),
    close:    ()  => ipcRenderer.send('window:close'),
  },

  settings: {
    get:   ()   => ipcRenderer.invoke('settings:get'),
    save:  (s)  => ipcRenderer.invoke('settings:save', s),
    reset: ()   => ipcRenderer.invoke('settings:reset'),
  },

  models: {
    scan: () => ipcRenderer.invoke('models:scan'),
  },

  encryption: {
    loadKey:     () => ipcRenderer.invoke('encryption:loadKey'),
    generateKey: () => ipcRenderer.invoke('encryption:generateKey'),
  },

  gallery: {
    list:       ()  => ipcRenderer.invoke('gallery:list'),
    readFile:   (p) => ipcRenderer.invoke('gallery:readFile', p),
    openFolder: ()  => ipcRenderer.invoke('gallery:openFolder'),
  },

  image: {
    save: (b64, name) => ipcRenderer.invoke('image:save', b64, name),
  },

  memory: {
    clear: () => ipcRenderer.invoke('memory:clear'),
  },

  webui: {
    launch:    ()   => ipcRenderer.invoke('webui:launch'),
    kill:      ()   => ipcRenderer.invoke('webui:kill'),
    isRunning: ()   => ipcRenderer.invoke('webui:isRunning'),
    onLog:     (cb) => ipcRenderer.on('webui:log',    (_e, line) => cb(line)),
    onReady:   (cb) => ipcRenderer.on('webui:ready',  ()         => cb()),
    onError:   (cb) => ipcRenderer.on('webui:error',  (_e, msg)  => cb(msg)),
    onExited:  (cb) => ipcRenderer.on('webui:exited', (_e, code) => cb(code)),
    removeAll: ()   => {
      ipcRenderer.removeAllListeners('webui:log');
      ipcRenderer.removeAllListeners('webui:ready');
      ipcRenderer.removeAllListeners('webui:error');
      ipcRenderer.removeAllListeners('webui:exited');
    },
  },

  a1111: {
    ping:      ()        => ipcRenderer.invoke('a1111:ping'),
    getModels: ()        => ipcRenderer.invoke('a1111:getModels'),
    setModel:  (m)       => ipcRenderer.invoke('a1111:setModel', m),
    getLoras:  ()        => ipcRenderer.invoke('a1111:getLoras'),
    generate:  (payload) => ipcRenderer.invoke('a1111:generate', payload),
    progress:  ()        => ipcRenderer.invoke('a1111:progress'),
  },

  openai: {
    chat:       (msgs) => ipcRenderer.invoke('openai:chat',       msgs),
    chatStream: (msgs) => ipcRenderer.invoke('openai:chatStream', msgs),
  },

});
