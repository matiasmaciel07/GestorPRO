const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow () {
    // FASE FINAL: Configuración de la Ventana Nativa Institucional
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        show: false, 
        backgroundColor: '#050505', 
        icon: path.join(__dirname, 'assets', 'icon.png'), 
        webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true,
            sandbox: true,
            disableBlinkFeatures: 'Auxclick',
            backgroundThrottling: false,
            spellcheck: false // Optimización de rendimiento de CPU
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;

    // Políticas estrictas de seguridad de sesión para aplicación financiera
    const ses = session.defaultSession;
    
    // 1. Bloquear permisos innecesarios (micrófono, cámara, geolocalización)
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(false);
    });

    // 2. Prevenir navegación hacia sitios externos en el frame principal
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            event.preventDefault();
            console.warn('Navegación externa bloqueada por seguridad:', navigationUrl);
        }
    });

    // 3. Prevenir creación de ventanas no autorizadas (pop-ups)
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
        }
        if (input.key === 'F12') {
            event.preventDefault();
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Desactivar aceleración por hardware si causa inestabilidad en gráficas integradas antiguas
// app.disableHardwareAcceleration();

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});