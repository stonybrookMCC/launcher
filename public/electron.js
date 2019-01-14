const {app, BrowserWindow, ipcMain} = require('electron');
const launcher = require('minecraft-launcher-core');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');

let mainWindow;
let launched = false;

const root = `${os.homedir()}/AppData/Roaming/.sbmcc`;
const userSettings = path.join(root, "settings.json");

if(!fs.existsSync(root)) fs.mkdirSync(root);
if(!fs.existsSync(userSettings)) {
    fs.writeFileSync(userSettings, JSON.stringify({
        packagePath: "https://www.dropbox.com/s/l97trmdw7ypwbgv/clientPackage.zip?dl=1",
        auth: null
    }));
}

function getSettings() {
    return(require(userSettings))
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 390,
        height: 514,
        center: true,
        maximizable: false,
        titleBarStyle: false,
        frame: false,
        show:false,
        icon: path.join(__dirname, 'icon.png'),
    });

    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);

    mainWindow.on('closed', () => mainWindow = null);

    launcher.event.on('data', () => {
        if(!launched) {
            launched = true;
            mainWindow.hide()
        }
    });

    launcher.event.on('close', (code) => {
        launched = false;
        mainWindow.webContents.send('exit', code);
        app.quit();
    });

    mainWindow.webContents.on('did-finish-load', () => mainWindow.show());
}

app.on('ready', createWindow);

launcher.event.on('error', (error) => console.error(error));

launcher.event.on('package-extract', () => {
    const settings = getSettings();
    settings.packagePath = null;
    fs.writeFileSync(userSettings, JSON.stringify(settings));
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('user-throw', async(event, arg) => {
    event.sender.send('user-catch', getSettings());
});

ipcMain.on('launch', async (event, arg) => {
    let auth;
    let settings = getSettings();
    if(settings.auth) {
        auth = settings.auth;
    } else {
        auth = await launcher.authenticator.getAuth(arg);
        settings.auth = auth;
        fs.writeFileSync(userSettings, JSON.stringify(settings));
    }

    const options = {
        authorization: auth,
        clientPackage: settings.packagePath,
        root: root,
        os: "windows",
        version: {
            number: "1.12.2",
            type: "release"
        },
        memory: {
            max: "500"
        }
    };

    launcher.core(options);
});