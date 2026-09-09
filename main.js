const path = require("path");
const { app, BrowserWindow, Menu, session, desktopCapturer, shell } = require("electron");
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
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a12",
      symbolColor: "#00f3ff",
      height: 40
    },
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
      .terminal-header, .chat-header {
        -webkit-app-region: drag;
      }
      .terminal-header button,
      .terminal-header a,
      .chat-header button,
      .chat-header a {
        -webkit-app-region: no-drag;
      }
      .chat-header {
        padding-right: calc(100vw - env(titlebar-area-width, calc(100vw - 150px)));
      }
      ::-webkit-scrollbar {
        display: none;
      }
    `);
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
