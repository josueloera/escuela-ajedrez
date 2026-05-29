const { app, BrowserWindow } = require('electron');
const path = require('path');

// Iniciamos el servidor web Express y Socket.io localmente
require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.ico'), // si hay icono
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Ocultamos el menú por defecto para que parezca una app nativa
  mainWindow.setMenuBarVisibility(false);

  // Cargamos la app desde el servidor local Express
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
