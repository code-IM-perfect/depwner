const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs');
const chokidar = require('chokidar');

const settingsPath = path.join(__dirname, './data/settings.json');
const logsPath = path.join(__dirname, './data/logs.json');
const quarantine = path.join(__dirname, './data/quarantine.json');
const cron = require('node-cron');

let win;

let watcher = null;

<<<<<<< Updated upstream
=======
function scheduleScanning() {
    console.log('scanner callled');
    if (!settings.schedule || !settings.schedule.active) {
        console.log("Scheduling is disabled.");
        return;
    }
    
    console.log("Setting up scanning schedule...");

    cron.getTasks().forEach(task => task.stop());

    const { freq, time, days } = settings.schedule;

    function getCurrentTimeIn24HFormat() {
        const now = new Date();
        const userTime = now.toLocaleTimeString('en-GB', { hour12: false }); // Get 24H format
        return userTime.slice(0, 5); // Extract HH:MM
    }

    if (freq === "hourly") {
        cron.schedule("0 * * * *", () => {
            console.log("Running hourly scan...");
            if (settings.locations.length > 0) {
                settings.locations.forEach(location => startManualScan(location, "custom"));
            } else {
                console.warn("No locations set for scanning.");
            }
        });
    } else if (freq === "daily") {
        const [hour, minute] = time.split(":").map(Number);
        cron.schedule(`${minute} ${hour} * * *`, () => {
            const currentTime = getCurrentTimeIn24HFormat();
            console.log(`Running daily scan at ${currentTime}...`);
            if (settings.locations.length > 0) {
                settings.locations.forEach(location => startManualScan(location, "custom"));
            } else {
                console.warn("No locations set for scanning.");
            }
        });
    } else if (freq === "weekly") {
        const [hour, minute] = time.split(":").map(Number);
        const dayMap = {
            sun: 0,
            mon: 1,
            tue: 2,
            wed: 3,
            thu: 4,
            fri: 5,
            sat: 6
        };

        Object.entries(days).forEach(([day, active]) => {
            if (active) {
                cron.schedule(`${minute} ${hour} * * ${dayMap[day]}`, () => {
                    const currentTime = getCurrentTimeIn24HFormat();
                    console.log(`Running weekly scan on ${day} at ${currentTime}...`);
                    if (settings.locations.length > 0) {
                        settings.locations.forEach(location => startManualScan(location, "custom"));
                    } else {
                        console.warn("No locations set for scanning.");
                    }
                });
            }
        });
    }
}

>>>>>>> Stashed changes
const startManualScan = async (pathToScan, type) => {
    console.log("Starting manual scan:", pathToScan, type);

    global.scanStatus = {
        status: 'scan',
        type: type,
        progress: 0,
        threatsFound: 0,
        currentFile: '',
    }

    let options;
    if (settings.yara) {
        options = { whitelist: "./scanner/whitelist.txt", dbPath: "./scanner/malware_hashes_full.db", yaraPath: "./scanner/output.yarc" };
    } else {
        options = { whitelist: "./scanner/overWhite.txt", dbPath: "./scanner/malware_hashes_overfitted.db", yaraPath: "" };
    }

    try {
        if (fs.statSync(pathToScan).isDirectory()) {
            options.folderPath = pathToScan;
        } else {
            options.filePath = pathToScan;
        }
        const { scanInput } = await import('./scanner/scanner.cjs');
        const result = await scanInput(options);
        global.scanStatus = 'completed'

    } catch (err) {
        console.error("Error during manual scan:", err);
        global.scanStatus.status = 'idle';
        // if (win) win.webContents.send("scanStatus", manualScanStatus);
    }
};

function startWatcher() {
    if (!settings || !Array.isArray(settings.locations) || settings.locations.length === 0) {
        console.warn("No directories configured for watching.");
        return;
    }

    console.log("Chokidar is watching:", settings.locations);

    // Updated event handlers to trigger manual scan.
    const attachWatcherEvents = (watcherInstance) => {
        watcherInstance.on("add", (filePath) => {
            console.log(`File added: ${filePath}`);
            if (win) win.webContents.send("fileEvent", { event: "add", filePath });
            // Automatically scan the new file.
            startManualScan(filePath, "custom");
        });
        watcherInstance.on("change", (filePath) => {
            console.log(`File changed: ${filePath}`);
            if (win) win.webContents.send("fileEvent", { event: "change", filePath });
            // Automatically scan the changed file.
            startManualScan(filePath, "custom");
        });
    };

    if (watcher) {
        console.log("Stopping previous watcher...");
        watcher.close().then(() => {
            watcher = chokidar.watch(settings.locations, {
                persistent: true,
                ignoreInitial: true,
                ignorePermissionErrors: true,
            });
            attachWatcherEvents(watcher);
            settings.locations.forEach((location) => {
                startManualScan(location, "autoScan")
            })
            console.log("Watcher restarted!");
        });
    } else {
        watcher = chokidar.watch(settings.locations, {
            persistent: true,
            ignoreInitial: true,
            ignorePermissionErrors: true,
        });
        attachWatcherEvents(watcher);
        settings.locations.forEach((location) => {
            startManualScan(location, "autoScan")
        })
        console.log("Watcher started!");
    }
}


<<<<<<< Updated upstream
var settings = require("./data/settings.json")
=======
// var settings = require(path.join(dataDir, './settings.json'))
>>>>>>> Stashed changes

const setSettings = async (_, setting) => {
    // console.log("-----------------------------------------------------");
    // console.log(settings);
    // console.log("-----------------------------------------------------");
    try {
        console.log("Settings Written");
        const fd = fs.openSync(settingsPath, 'r+');
        const oldSettings = JSON.parse(fs.readFileSync(fd, 'utf8'));
        fs.closeSync(fd);
        console.log("Old Settings:")
        console.log(oldSettings);
        console.log(settingsPath);
        console.log(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))); 
        console.log(setting);
        fs.writeFileSync(settingsPath, setting);
        const newSettings = JSON.parse(setting);
        settings = newSettings;  
        if (JSON.stringify(newSettings.locations) !== JSON.stringify(oldSettings.locations)) {
            startWatcher();
        }
        if (JSON.stringify(newSettings.schedule) !== JSON.stringify(oldSettings.schedule)) {
            scheduleScanning();
        }        
        console.log("------------");
        console.log(oldSettings);
        console.log(newSettings);
        console.log("------------");
    } catch (err) {
        console.error("Error writing settings:", err);
    }
}
const getSettings = async () => {
    const fd = fs.openSync(settingsPath, 'r+');
    const settingsObject = fs.readFileSync(fd, 'utf8');
    fs.closeSync(fd);
    console.log("Settings Fetched")
    console.log(JSON.parse(settingsObject));
    console.log(settings);
    return settingsObject
}


const getThreats = async () => {
    let threatsObject = fs.readFileSync(quarantine, 'utf-8')
    console.log("Threats Fetched")
    return threatsObject
}


let scanStatus = {
    status: 'idle', // idle if no manual scan / scan if manual scan
    type: 'full', // 'full' Full Scan / 'custom' Custom Scan
    progress: 0, // The number of files scanned
    threatsFound: [],
    filesToScan: 100,
    currentFile: '',
}
async function getStatus() {
    return JSON.stringify(scanStatus)
}

const getStats = async () => {
    let statsObject = fs.readFileSync(logsPath, 'utf-8')
    console.log("Logs Fetched")
    return statsObject

}


const openFileDialog = async () => {
    const { cancelled, filePaths } = await dialog.showOpenDialog(win, { title: "Choose file to scan", properties: ["openFile"] })
    if (cancelled || !filePaths) {
        return "user cancelled"
    } else {
        return filePaths[0]
    }
}

const openFolderDialog = async () => {
    const { cancelled, filePaths } = await dialog.showOpenDialog(win, { title: "Choose folder to scan", properties: ["openDirectory"] })
    if (cancelled || !filePaths) {
        return "user cancelled"
    } else {
        return filePaths[0]
    }
}

// NEW: Pre-load CSV in app.whenReady() for faster future scans.
// const preloadCsv = async () => {
//     try {
//         const { loadCsvToBloom } = await import('./scanner/scanner.cjs');
//         // Initialize database and import CSV if needed
//         const dbPath = path.join(__dirname, 'scanner', 'malware_hashes.db');
//         const csvPath = path.join(__dirname, 'scanner', 'full.csv');
//
//         // Try to load DB first, if it fails or is empty, it will import from CSV
//         const csvData = await loadCsvToBloom(fs.existsSync(dbPath) ? dbPath : csvPath);
//         global.preloadedCsvData = csvData;
//         console.log("Database initialized successfully");
//     } catch (err) {
//         console.error("Error initializing database:", err);
//     }
// };

const removeThreat = async (_, threat) => {
    // Use threat.oldPath

}

const restoreThreat = async (_, threat) => {
    // Use threat.oldPath and threat.hash
}

const icon = nativeImage.createFromPath('./data/Logo_smol.png')
function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        title: "dePWNer",
        autoHideMenuBar: true,
        icon: icon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile('./build/index.html');
}


let tray = null
let isQuiting = false
app.whenReady().then(() => {
    ipcMain.handle("getSettings", getSettings)
    ipcMain.handle("getStats", getStats)
    ipcMain.handle("getThreats", getThreats)
    ipcMain.handle("getScanStatus", getStatus)
    ipcMain.on("setSettings", setSettings)
    ipcMain.on("startManualScan", (_, pathToScan, type) => {
        startManualScan(pathToScan, type);
    });
    ipcMain.handle("selectFile", openFileDialog)
    ipcMain.handle("selectFolder", openFolderDialog)
    ipcMain.handle("reloadWatcher", () => {
        console.log("Reloading watcher...");
        startWatcher();
    });
    ipcMain.handle("removeThreat", removeThreat)
    ipcMain.handle("restoreThreat", restoreThreat)

    try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        global.settings = settings;
        console.log("Settings Loaded:", settings);
    } catch (err) {
        console.error("Error loading settings:", err);
    }

    tray = new Tray(icon)
    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App', click: function () {
                win.show();
            }
        },
        {
            label: 'Quit', click: function () {
                isQuiting = true;
                app.quit();
            }
        }
    ]);
    tray.setToolTip('dePWNer by pwnedraccoons')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
        if (win.isVisible()) {
            win.hide()
        } else {
            win.show()
        }
    });


    createWindow()

    win.on('minimize', function (event) {
        event.preventDefault();
        win.hide();
    });

    win.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            win.hide();
        }

        return false;
    });

    console.log("Main window loaded, starting watcher...");
    startWatcher();

    // Pre-load CSV database.
    // preloadCsv();
    scheduleScanning()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (watcher) watcher.close();
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
