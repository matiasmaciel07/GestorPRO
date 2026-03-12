const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow () {
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
            spellcheck: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;

    const ses = session.defaultSession;
    
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(false);
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            event.preventDefault();
            console.warn('Navegación externa bloqueada por seguridad:', navigationUrl);
        }
    });

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
        // Implementación de escala idéntica al navegador (80%)
        mainWindow.webContents.setZoomFactor(0.8);
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Limpieza estricta de caché para reflejar siempre los últimos cambios de VS Code
    session.defaultSession.clearCache().then(() => {
        createWindow();
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
// INYECCIÓN DE TELEMETRÍA GLOBAL (Backend / Main Process)
process.on('uncaughtException', (error) => {
    console.error('[Arquitectura Main] Error Crítico No Capturado:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
            window.dispatchEvent(new CustomEvent('network:circuit-breaker', { detail: { state: 'OPEN' } }));
            console.error("Main Process Fatal Error:", \`${error.message.replace(/`/g, '\\`')}\`);
        `).catch(e => console.error(e));
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Arquitectura Main] Rechazo de Promesa No Manejado:', reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
        const msg = reason instanceof Error ? reason.message : String(reason);
        mainWindow.webContents.executeJavaScript(`
            console.error("Main Process Async Error:", \`${msg.replace(/`/g, '\\`')}\`);
        `).catch(e => console.error(e));
    }
});