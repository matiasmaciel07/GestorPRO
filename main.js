const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow () {
    // FASE FINAL: Configuración de la Ventana Nativa Institucional
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        show: false, // Ocultar hasta que cargue para evitar pantallazos blancos
        backgroundColor: '#050505', // Mismo fondo Super Dark de tu CSS
        // Nota: Asegúrate de guardar un icono llamado 'icon.png' y 'icon.ico' en tu carpeta assets/
        icon: path.join(__dirname, 'assets', 'icon.png'), 
        webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true,
            sandbox: true,
            disableBlinkFeatures: 'Auxclick',
            backgroundThrottling: false 
        }
    });

    // Eliminar el menú superior por defecto (Archivo, Editar, Ver...) para que sea 100% App
    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;

    // Bloquear el menú contextual y las herramientas de desarrollo por atajos
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
        }
        if (input.key === 'F12') {
            event.preventDefault();
        }
    });

    // Cargar tu estructura MVC principal
    mainWindow.loadFile('index.html');

    // Mostrar la ventana suavemente una vez que el DOM inicial esté renderizado
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Liberar memoria al cerrar
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Cuando el motor interno de Electron (Mismo core que Brave) esté inicializado
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Cerrar el proceso completamente cuando se cierren las ventanas (excepto en macOS)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});