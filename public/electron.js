const {app, BrowserWindow, ipcMain, globalShortcut, dialog} = require('electron');
const {autoUpdater} = require('electron-updater');
const launcher = require('minecraft-launcher-core');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');
const request = require('request');

let mainWindow;
let launched = false;

const root = `${os.homedir()}/AppData/Roaming/.sbmcc`;
const userSettings = path.join(root, "settings.json");

if(!fs.existsSync(root)) fs.mkdirSync(root);
if(!fs.existsSync(userSettings)) {
    fs.writeFileSync(userSettings, JSON.stringify({
        clientPackage: "https://www.dropbox.com/s/l97trmdw7ypwbgv/clientPackage.zip?dl=1",
        packageInfo: {
            version: 1,
            installed: false
        },
        version: {
            number: "1.12.2",
            type: "release"
        },
        authorization: null,
        memory: {
            max: "500",
            min: "100",
            override: false
        },
        endpoints: {
            gist: "https://napstabot.club/launcher.json",
            error: "https://discordapp.com/api/webhooks/558094269160882196/v5LiNUHlQJzmKt0voeDcgCP4BhBEZpDQOuicJ712p3fZa83_ORpGLo4qVjDomT3iYNMg"
        }
    }, null, 4));
}

function getSettings() {
    return new Promise(resolve => {
        const settings = require(userSettings);
       
        request(settings.endpoints.gist, function(error, response, body) {
            if(error || response.statusCode !== 200) resolve(globalSettings);
            const options = JSON.parse(body);

            options.authorization = settings.authorization

            if(settings.packageInfo.version !== options.packageInfo.version) {
                console.log("Launching with package")
            } else options.clientPackage = null;

            resolve({
                ...options,
                root: root,
                os: 'windows'
            });
        });
    })
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

    launcher.event.on('data', (data) => {
        mainWindow.webContents.send('log', data);
        if(!launched) {
            launched = true;
            mainWindow.hide()
        }
    });

    launcher.event.on('download-status', (data) => {
        mainWindow.webContents.send('download-status', data);
    });

    launcher.event.on('close', (code) => {
        launched = false;
        globalShortcut.unregisterAll();
        app.quit();
    });

    mainWindow.webContents.on('did-finish-load', () => mainWindow.show());

    globalShortcut.register('CommandOrControl+N', () => {
        mainWindow.webContents.openDevTools();
    });
}

app.on('ready', () => {
    createWindow();
    // autoUpdater.checkForUpdates();
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'New Update',
        message: 'Found updates, do you want update now?',
        buttons: ['Yes', 'No']
    }, (buttonIndex) => {
        if (buttonIndex === 0) {
            autoUpdater.quitAndInstall();
        }
        else {
            updater.enabled = true;
            updater = null
        }
    })
});

launcher.event.on('error', async (error) => {
    const settings = await getSettings();
    request({url:settings.endpoints.error, method:"POST", json: {
        "embeds": [{
          "title": settings.authorization.name,
          "description": error
        }]
    }})
});

launcher.event.on('package-extract', async () => {
    const settings = await getSettings();

    settings.clientPackage = null;
    fs.writeFileSync(userSettings, JSON.stringify(settings, null, 4));
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('user-throw', async(event, arg) => {
    event.sender.send('user-catch', await getSettings());
});

ipcMain.on('launch', async (event, arg) => {
    let authorization;
    let settings = await getSettings();
    if(settings.authorization) {
        authorization = settings.authorization;
        if(authorization.name !== arg) {
            authorization.name = arg;
            fs.writeFileSync(userSettings, JSON.stringify(settings, null, 4));
        }
    } else {
        authorization = await launcher.authenticator.getAuth(arg);
        settings.authorization = authorization;
        fs.writeFileSync(userSettings, JSON.stringify(settings, null, 4));
    }

    mainWindow.webContents.send('log', settings);

    launcher.core(settings);
});