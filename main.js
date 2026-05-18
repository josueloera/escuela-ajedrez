const { app, BrowserWindow } = require('electron');
const path = require('path');

// --- TU CEREBRO EN LA NUBE ---
const GAME_URL = 'https://escuela-ajedrez.onrender.com'; 

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "JL Chess Escolar",
        // Usamos 'logo.png' que ya vi que tienes en tu carpeta
        icon: path.join(__dirname, 'logo.png'), 
        autoHideMenuBar: true, // Oculta el menú de archivo/editar para que se vea Pro
        webPreferences: {
            nodeIntegration: false
        }
    });

    win.loadURL(GAME_URL);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});