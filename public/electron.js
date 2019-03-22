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

const root = `${os.homedir()}\\AppData\\Roaming\\.sbmcc`;
const userSettings = path.join(root, "settings.json");

const defaultSettings = {
    clientPackage: "https://www.dropbox.com/s/l97trmdw7ypwbgv/clientPackage.zip?dl=1",
    packageInfo: {
        version: 1,
        installed: false
    },
    version: {
        number: "1.12.2",
        type: "release"
    },
    launcher_version: "1.5.0",
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
};

if(!fs.existsSync(root)) fs.mkdirSync(root);
if(!fs.existsSync(userSettings)) {
    fs.writeFileSync(userSettings, JSON.stringify(defaultSettings, null, 4));
}

function getSettings() {
    return new Promise(resolve => {
        let settings = JSON.parse(fs.readFileSync(userSettings, {encoding:"utf-8"}));

        if(!settings.launcher_version) {
            let newConfig = defaultSettings;

            newConfig.authorization = settings.auth;
            if(settings.packagePath === null) newConfig.packageInfo.installed = true;

            fs.writeFileSync(userSettings, JSON.stringify(newConfig, null, 4));
            settings = newConfig;
        }

        request(settings.endpoints.gist, function(error, response, body) {
            if(error || response.statusCode !== 200) resolve(settings);
            const options = JSON.parse(body);

            options.launcher_version = settings.launcher_version;
            options.authorization = settings.authorization;
            options.packageInfo.installed = settings.packageInfo.installed;
            options.memory.override = settings.memory.override;

            if(settings.packageInfo.version !== options.packageInfo.version) options.packageInfo.installed = false;
            if(options.memory.override) options.memory = settings.memory;

            resolve({
                ...options,
                root: root,
                os: 'windows'
            });
        });
    })
}

async function sendErrorReport(error) {
    const settings = JSON.parse(fs.readFileSync(userSettings, {encoding:"utf-8"}));

    if(String.fromCharCode.apply(null, error).includes("future release")) return;

    request.post({url:settings.endpoints.error, json: {
        "embeds": [{
            "title": `Username is ${settings.authorization.name} - Max memory is ${settings.memory.max}mb - Override set to ${settings.memory.override}`,
            "description": String.fromCharCode.apply(null, error)
        }]
    }});
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
        setTimeout(function() {app.quit()}, 2000);
    });

    mainWindow.webContents.on('did-finish-load', () => mainWindow.show());

    globalShortcut.register('CommandOrControl+N', () => {
        mainWindow.webContents.openDevTools();
    });
}

app.on('ready', () => {
    createWindow();
    autoUpdater.checkForUpdates();
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

launcher.event.on('error', async (error) => await sendErrorReport(error));

launcher.event.on('package-extract', async () => {
    const settings = JSON.parse(fs.readFileSync(userSettings, {encoding:"utf-8"}));

    settings.packageInfo.installed = true;
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

    if(settings.packageInfo.installed) settings.clientPackage = null;

    launcher.core(settings);
});