const path = require("path");
const { app, BrowserWindow, Menu, session, desktopCapturer, shell, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { APP_URL } = require("./config");

const ICON_PATH = path.join(__dirname, "build", "icon.png");

let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return ["media", "display-capture"].includes(permission);
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(["media", "display-capture"].includes(permission));
    });

    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        callback({ video: sources[0], audio: "loopback" });
      });
    });

    ipcMain.on("window-minimize", () => {
      if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on("window-maximize", () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
    });

    ipcMain.on("window-close", () => {
      if (mainWindow) mainWindow.close();
    });

    createWindow();

    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#000000",
    title: "FreeGram",
    icon: ICON_PATH,
    show: false,
    frame: false,
    webPreferences: {
      preload: __dirname + "/preload.js",
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(`
      body.is-electron::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 140px;
        height: 36px;
        z-index: 9999;
        -webkit-app-region: drag;
        pointer-events: auto;
      }
      .terminal-header, .chat-header {
        -webkit-app-region: drag;
      }
      .terminal-header button,
      .terminal-header a,
      .chat-header button,
      .chat-header a,
      .window-controls,
      .win-control-btn,
      .site-menu,
      .site-menu *,
      .login-box,
      .login-box * {
        -webkit-app-region: no-drag;
      }
      body.is-electron .chat-header {
        padding-right: 140px;
      }
      body.is-electron .site-menu {
        top: 10px;
        right: 140px;
      }
      #themeModal,
      #safetyModal,
      #leaveConfirmModal {
        z-index: 100000;
      }
      ::-webkit-scrollbar {
        display: none;
      }
    `);

    mainWindow.webContents.executeJavaScript(`
      (function() {
        document.body.classList.add('is-electron');
        if (!document.getElementById('windowControls')) {
          const div = document.createElement('div');
          div.id = 'windowControls';
          div.className = 'window-controls';
          div.innerHTML = '<button type="button" class="win-control-btn win-minimize-btn" id="winMinimizeBtn" title="Свернуть" aria-label="Minimize"><i class="fas fa-minus" aria-hidden="true"></i></button><button type="button" class="win-control-btn win-maximize-btn" id="winMaximizeBtn" title="Развернуть" aria-label="Maximize"><i class="far fa-square" aria-hidden="true"></i></button><button type="button" class="win-control-btn win-close-btn" id="winCloseBtn" title="Закрыть" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>';
          document.body.appendChild(div);
          document.getElementById('winMinimizeBtn')?.addEventListener('click', () => window.electronAPI?.minimize());
          document.getElementById('winMaximizeBtn')?.addEventListener('click', () => window.electronAPI?.maximize());
          document.getElementById('winCloseBtn')?.addEventListener('click', () => window.electronAPI?.close());
        } else {
          document.getElementById('windowControls').style.display = 'flex';
        }
      })();
    `).catch(() => {});
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const targetHost = new URL(url).host;
    const currentHost = new URL(APP_URL).host;
    if (targetHost !== currentHost) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
