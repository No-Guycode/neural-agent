const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  // Settings
  settings: {
    get:  ()           => ipcRenderer.invoke('settings:get'),
    save: (s)          => ipcRenderer.invoke('settings:save', s),
  },

  // Models
  models: {
    scan: () => ipcRenderer.invoke('models:scan'),
  },

  // Encryption
  encryption: {
    loadKey:     ()  => ipcRenderer.invoke('encryption:loadKey'),
    generateKey: ()  => ipcRenderer.invoke('encryption:generateKey'),
  },

  // Gallery
  gallery: {
    list:          ()     => ipcRenderer.invoke('gallery:list'),
    readEncrypted: (p)    => ipcRenderer.invoke('gallery:readEncrypted', p),
  },

  // Image
  image: {
    save: (b64, name) => ipcRenderer.invoke('image:save', b64, name),
  },

  // Memory
  memory: {
    clear: () => ipcRenderer.invoke('memory:clear'),
  },

  // A1111
  a1111: {
    ping:     ()          => ipcRenderer.invoke('a1111:ping'),
    getModels:()          => ipcRenderer.invoke('a1111:getModels'),
    setModel: (m)         => ipcRenderer.invoke('a1111:setModel', m),
    getLoras: ()          => ipcRenderer.invoke('a1111:getLoras'),
    generate: (payload)   => ipcRenderer.invoke('a1111:generate', payload),
    progress: ()          => ipcRenderer.invoke('a1111:progress'),
  },

  // OpenAI
  openai: {
    chat:       (msgs) => ipcRenderer.invoke('openai:chat', msgs),
    chatStream: (msgs) => ipcRenderer.invoke('openai:chatStream', msgs),
  },
});
