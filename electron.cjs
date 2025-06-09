const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, Notification } = require('electron')
const path = require('node:path')
const fs = require('node:fs');
const chokidar = require('chokidar');
const { pathToFileURL } = require('url');

const homedir = require('os').homedir();
const dataDir = path.join(homedir, './dePWNer')
const scannerDir = path.join(dataDir, './scanner/')

if (!fs.existsSync(dataDir)) {
    console.log('First Run Detected')
    fs.cpSync(path.join(__dirname, './data/'), dataDir, { recursive: true }, (err) => {
        if (err) {
            console.error(err)
        } else {
            console.log("copied data files")
        }
    })
    fs.cpSync(path.join(__dirname, './scanner/'), scannerDir, { recursive: true }, (err) => {
        if (err) {
            console.error(err)
        } else {
            console.log("copied scanner files")
        }
    })
    // The python script and its copying logic have been removed.
    // The static/ directory in user's dataDir is no longer created by this logic.
}

const settingsPath = path.join(dataDir, './settings.json');
const logsPath = path.join(dataDir, './logs.json');
const quarantine = path.join(dataDir, './quarantine.json');
const cron = require('node-cron');

let win;

let watcher = null;

function scheduleScanning() {
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

const startManualScan = async (pathToScan, type) => {
    if (!pathToScan) {
        console.error("Error: pathToScan is undefined.");
        return;
    }
    console.log("Starting manual scan:", pathToScan, type);

    global.scanStatus = {
        status: 'scan',
        type: type,
        progress: 0,
        threatsFound: [],
        currentFile: '',
    }

    let options;
    if (settings.yara) {
        options = {
            dbPath: path.join(dataDir, "./scanner/malware_hashes.db"),
            yaraPath: path.join(dataDir, "./scanner/output.yarc"),
            scannerDir: scannerDir,
            dataDir: dataDir
        };
    } else {
        options = {
            dbPath: path.join(dataDir, "simple_malware_hashes.db"),
            yaraPath: "",
            scannerDir: scannerDir,
            dataDir: dataDir
        };
    }

    options.type = type

    try {
        if (fs.statSync(pathToScan).isDirectory()) {
            options.folderPath = pathToScan;
        } else {
            options.filePath = pathToScan;
        }
        console.log(options);
        // Replace dynamic import with file URL conversion:
        const scannerModuleUrl = pathToFileURL(path.join(__dirname, './scanner/scanner.cjs')).href;
        const { scanInput } = await import(scannerModuleUrl);
        const result = await scanInput(options);
        global.scanStatus = 'completed';
    } catch (err) {
        console.error("Error during manual scan:", err);
        global.scanStatus.status = 'idle';
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


var settings = require(path.join(dataDir, './settings.json'));

// Ensure settings.lastUpdated exists
// if (settings.lastUpdated === undefined) {
//     settings.lastUpdated = "Never";
//     try {
//         fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
//         console.log("Initialized and saved settings.lastUpdated");
//     } catch (err) {
//         console.error("Error saving initial settings.lastUpdated:", err);
//     }
// }


const setSettings = async (_, setting) => {
    try {
        console.log("Settings Written");
        fs.writeFileSync(settingsPath, setting);
        settings = JSON.parse(setting);
        startWatcher();
        scheduleScanning()
    } catch (err) {
        console.error("Error writing settings:", err);
    }
}
const getSettings = async () => {
    let settingsObject = fs.readFileSync(settingsPath, 'utf-8')
    console.log("Settings Fetched")
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

const icon = nativeImage.createFromPath(path.join(dataDir, './Logo_smol.png'))
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

// New function to update malware definitions database
async function updateMalwareDefinitions() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("DEBUG [1]: Starting updateDefinitions process");
            console.log("DEBUG [2]: Fetching latest definitions from Malware Bazaar (CSV)...");
            const response = await fetch('https://bazaar.abuse.ch/export/csv/recent/');
            if (!response.ok) {
                console.error("DEBUG [3-ERROR]: Fetch failed with status:", response.status, response.statusText);
                throw new Error(`Failed to fetch definitions: ${response.statusText}`);
            }
            
            console.log("DEBUG [3]: Fetch successful with status:", response.status);
            const csvData = await response.text();
            console.log("DEBUG [4]: Fetched CSV data length:", csvData.length);
            console.log("DEBUG [5]: CSV sample (first 500 chars):", csvData.substring(0, 500));

            const dbPath = settings.yara ? path.join(dataDir, 'scanner/malware_hashes.db') : path.join(dataDir, 'simple_malware_hashes.db');
            console.log("DEBUG [6]: Using database path:", dbPath);
            console.log("DEBUG [6.1]: settings.yara =", settings.yara);
            console.log("DEBUG [6.2]: scannerDir =", scannerDir);
            console.log("DEBUG [6.3]: dataDir =", dataDir);
            
            // Ensure directory exists for simple_malware_hashes.db
            if (!settings.yara && !fs.existsSync(path.dirname(dbPath))) {
                console.log("DEBUG [7]: Creating directory for simple database:", path.dirname(dbPath));
                fs.mkdirSync(path.dirname(dbPath), { recursive: true });
                console.log("DEBUG [8]: Directory created successfully");
            } else if (settings.yara && !fs.existsSync(path.dirname(dbPath))) {
                console.log("DEBUG [7]: Creating scanner directory:", path.dirname(dbPath));
                fs.mkdirSync(path.dirname(dbPath), { recursive: true });
                console.log("DEBUG [8]: Scanner directory created successfully");
            }

            console.log("DEBUG [9]: Loading sqlite3 module");
            const sqlite3 = require('sqlite3').verbose();
            console.log("DEBUG [10]: Opening database connection to:", dbPath);
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error("DEBUG [11-ERROR]: Database open failed:", err.message);
                    reject({ success: false, message: `Error opening database: ${err.message}` });
                    return;
                }
                console.log("DEBUG [11]: Database opened successfully");
            });

            // Parse the CSV data
            console.log("DEBUG [12]: Parsing CSV data");
            const lines = csvData.split('\n');
            console.log("DEBUG [13]: Total lines in CSV:", lines.length);
            
            // Parse headers to find needed column indices
            let md5Index = -1, firstSeenIndex = -1, signatureIndex = -1;
            let headerFound = false;
            let dataRows = [];
            
            // First, find the header row
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Check if this is the header line with column definitions
                if (line.startsWith('#') && line.includes("first_seen_utc") && 
                    line.includes("md5_hash") && line.includes("signature")) {
                    // This is the header line
                    console.log("DEBUG [14]: Found CSV header definition line:", line);
                    
                    const headerLine = line.substring(1).trim(); // Remove '#'
                    const headerFields = headerLine
                        .split(',')
                        .map(h => h.trim().replace(/^"|"$/g, ''));
                        
                    md5Index = headerFields.findIndex(h => h === "md5_hash");
                    firstSeenIndex = headerFields.findIndex(h => h === "first_seen_utc");
                    signatureIndex = headerFields.findIndex(h => h === "signature");
                    
                    console.log("DEBUG [15]: Found indices - md5:", md5Index, 
                                "firstSeen:", firstSeenIndex, 
                                "signature:", signatureIndex);
                                
                    if (md5Index === -1 || firstSeenIndex === -1 || signatureIndex === -1) {
                        console.log("DEBUG [16]: Header indices not found in comment, will look in data rows");
                    } else {
                        headerFound = true;
                    }
                    
                    continue;
                }
                
                // Skip all other comment lines
                if (line.startsWith('#')) continue;
                
                // If we haven't found the header yet, this must be it
                if (!headerFound) {
                    // This is the actual CSV header row
                    const headerFields = line
                        .split(',')
                        .map(h => h.trim().replace(/^"|"$/g, ''));
                    
                    console.log("DEBUG [16]: Extracted headers from CSV row:", headerFields);
                    
                    md5Index = headerFields.indexOf('md5_hash');
                    firstSeenIndex = headerFields.indexOf('first_seen_utc');
                    signatureIndex = headerFields.indexOf('signature');
                    
                    console.log("DEBUG [17]: Found indices - md5:", md5Index, 
                                "firstSeen:", firstSeenIndex, 
                                "signature:", signatureIndex);
                                
                    if (md5Index === -1 || firstSeenIndex === -1 || signatureIndex === -1) {
                        console.error("DEBUG [18-ERROR]: Required header field not found");
                        db.close();
                        reject({ 
                            success: false, 
                            message: `Required header field (md5_hash, first_seen_utc, or signature) not found in CSV. Found: ${headerFields.join(', ')}` 
                        });
                        return;
                    }
                    
                    headerFound = true;
                    continue; // Skip processing the header row as data
                }
                
                // This is a data row
                dataRows.push(line);
            }

            const totalEntries = dataRows.length;
            console.log("DEBUG [19]: Total data rows found:", totalEntries);
            
            if (totalEntries === 0) {
                console.log("DEBUG [20]: No data entries found, resolving early");
                db.close();
                resolve({ 
                    success: true, 
                    message: 'No new data entries in the feed.', 
                    lastUpdated: settings.lastUpdated 
                });
                return;
            }

            // Create table if it doesn't exist
            console.log("DEBUG [21]: Setting up database structure");
            db.serialize(() => {
                console.log("DEBUG [22]: Creating table if not exists");
                db.run(`CREATE TABLE IF NOT EXISTS malware_hashes (
                    md5_hash TEXT PRIMARY KEY,
                    first_seen_utc TEXT,
                    signature TEXT
                )`, function(err) {
                    if (err) {
                        console.error("DEBUG [23-ERROR]: Error creating table:", err.message);
                        db.close();
                        reject({ success: false, message: `Error creating database table: ${err.message}` });
                        return;
                    }
                    console.log("DEBUG [23]: Table created or verified successfully");

                    // Begin transaction
                    console.log("DEBUG [24]: Beginning transaction");
                    db.run('BEGIN TRANSACTION', function(err) {
                        if (err) {
                            console.error("DEBUG [25-ERROR]: Error starting transaction:", err.message);
                            db.close();
                            reject({ success: false, message: `Error starting database transaction: ${err.message}` });
                            return;
                        }
                        console.log("DEBUG [25]: Transaction started successfully");
                        
                        // Prepare statements
                        console.log("DEBUG [26]: Preparing SQL statements");
                        const checkStmt = db.prepare('SELECT 1 FROM malware_hashes WHERE md5_hash = ?');
                        const insertStmt = db.prepare('INSERT INTO malware_hashes (md5_hash, first_seen_utc, signature) VALUES (?, ?, ?)');
                        console.log("DEBUG [27]: Statements prepared successfully");
                        
                        // Process each row
                        console.log("DEBUG [28]: Starting to process data rows");
                        let addedCount = 0;
                        let processedCount = 0;
                        
                        processNextRow(0);
                        
                        function processNextRow(index) {
                            if (index % 100 === 0) {
                                console.log(`DEBUG [29]: Processing row ${index}/${totalEntries}`);
                            }
                            
                            if (index >= dataRows.length) {
                                console.log("DEBUG [30]: All rows processed, finalizing");
                                // All rows processed, finalize statements and commit
                                console.log("DEBUG [31]: Finalizing prepared statements");
                                checkStmt.finalize();
                                insertStmt.finalize();
                                console.log("DEBUG [32]: Statements finalized successfully");
                                
                                console.log("DEBUG [33]: Committing transaction");
                                db.run('COMMIT', function(err) {
                                    if (err) {
                                        console.error("DEBUG [34-ERROR]: Error committing transaction:", err.message);
                                        console.log("DEBUG [35]: Attempting rollback");
                                        db.run('ROLLBACK', function(rollbackErr) {
                                            if (rollbackErr) {
                                                console.error("DEBUG [36-ERROR]: Rollback also failed:", rollbackErr.message);
                                            } else {
                                                console.log("DEBUG [36]: Rollback successful");
                                            }
                                            db.close();
                                            reject({ success: false, message: `Error committing transaction: ${err.message}` });
                                        });
                                        return;
                                    }
                                    console.log("DEBUG [34]: Transaction committed successfully");
                                    
                                    // Update settings and send response
                                    console.log("DEBUG [35]: Updating settings with lastUpdated");
                                    settings.lastUpdated = new Date().toLocaleString();
                                    try {
                                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
                                        console.log("DEBUG [36]: Settings updated successfully");
                                    } catch (fsErr) {
                                        console.error("DEBUG [36-ERROR]: Error writing settings:", fsErr.message);
                                    }
                                    
                                    console.log(`DEBUG [37]: Operation completed - Added ${addedCount} new entries out of ${totalEntries} processed`);
                                    
                                    if (win) {
                                        console.log("DEBUG [38]: Sending updates to window");
                                        win.webContents.send('settingsUpdated', settings);
                                        win.webContents.send('updateProgress', { 
                                            processed: totalEntries, 
                                            total: totalEntries, 
                                            completed: true 
                                        });
                                        console.log("DEBUG [39]: Updates sent to window");
                                    }
                                    
                                    console.log("DEBUG [40]: Closing database");
                                    db.close();
                                    console.log("DEBUG [41]: Database closed successfully");
                                    console.log("DEBUG [42]: Operation complete - resolving promise");
                                    resolve({ 
                                        success: true, 
                                        message: `Added ${addedCount} new malware definitions from ${totalEntries} processed entries.`, 
                                        lastUpdated: settings.lastUpdated 
                                    });
                                });
                                return;
                            }
                            
                            const row = dataRows[index];
                            
                            // Handle CSV parsing properly - the values may contain commas inside quotes
                            let values = [];
                            let currentValue = '';
                            let inQuotes = false;
                            
                            for (let i = 0; i < row.length; i++) {
                                const char = row[i];
                                
                                if (char === '"') {
                                    inQuotes = !inQuotes;
                                } else if (char === ',' && !inQuotes) {
                                    values.push(currentValue.trim());
                                    currentValue = '';
                                } else {
                                    currentValue += char;
                                }
                            }
                            
                            // Add the last value
                            values.push(currentValue.trim());
                            
                            // Clean up quoted values
                            values = values.map(v => v.replace(/^"|"$/g, ''));
                            
                            const md5_hash = values[md5Index];
                            const first_seen_utc_val = values[firstSeenIndex];
                            let signature_val = values[signatureIndex];
                            
                            if (!md5_hash || md5_hash.length !== 32) { // Basic MD5 validation
                                console.warn(`DEBUG [43-WARN]: Skipping invalid MD5 hash: '${md5_hash}' in row: ${index}`);
                                processNextRow(index + 1);
                                return;
                            }
                            
                            if (!signature_val || signature_val.toLowerCase() === 'n/a' || signature_val === '') {
                                signature_val = 'MalwareBazaar_Recent_CSV';
                                if (index % 100 === 0) {
                                    console.log(`DEBUG [44]: Using default signature for row ${index}`);
                                }
                            }
                            
                            // Check if hash already exists
                            checkStmt.get(md5_hash, function(err, row) {
                                if (err) {
                                    console.error(`DEBUG [45-ERROR]: Error checking MD5 ${md5_hash} at row ${index}: ${err.message}`);
                                    processNextRow(index + 1);
                                    return;
                                }
                                
                                if (!row) {
                                    // Hash doesn't exist, insert it
                                    insertStmt.run(md5_hash, first_seen_utc_val, signature_val, function(err) {
                                        if (err) {
                                            console.error(`DEBUG [46-ERROR]: Failed to insert MD5 ${md5_hash} at row ${index}: ${err.message}`);
                                        } else {
                                            addedCount++;
                                            if (addedCount % 100 === 0) {
                                                console.log(`DEBUG [46]: Added ${addedCount} new entries so far`);
                                            }
                                        }
                                        
                                        processedCount++;
                                        if (win && processedCount % 100 === 0) {
                                            win.webContents.send('updateProgress', { 
                                                processed: processedCount, 
                                                total: totalEntries 
                                            });
                                        }
                                        
                                        processNextRow(index + 1);
                                    });
                                } else {
                                    // Hash already exists, skip insertion
                                    processedCount++;
                                    if (processedCount % 1000 === 0) {
                                        console.log(`DEBUG [48]: Skipped existing hash at row ${index}, processed ${processedCount}/${totalEntries}`);
                                    }
                                    
                                    if (win && processedCount % 100 === 0) {
                                        win.webContents.send('updateProgress', { 
                                            processed: processedCount, 
                                            total: totalEntries 
                                        });
                                    }
                                    
                                    processNextRow(index + 1);
                                }
                            });
                        }
                    });
                });
            });

        } catch (error) {
            console.error("DEBUG [FATAL ERROR]: Error in updateDefinitions:", error);
            console.error("DEBUG [FATAL ERROR]: Stack trace:", error.stack);
            if (win) { // Send error state for progress
                console.log("DEBUG [FATAL ERROR]: Sending error to window");
                win.webContents.send('updateProgress', { error: true, message: error.message });
            }
            reject({ success: false, message: `Error updating definitions. ${error.message}` });
        }
    });
}

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
    ipcMain.handle("removeThreat", removeThreat);
    ipcMain.handle("restoreThreat", restoreThreat);

    // Updated to use the new function
    ipcMain.handle("updateDefinitions", updateMalwareDefinitions);

    try {
        // Settings are already loaded and potentially modified above for lastUpdated
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        global.settings = settings; // Ensure global settings is also up-to-date
        console.log("Settings Loaded:", settings);
    } catch (err) {
        // This catch might not be necessary if settings are guaranteed by the require and initialization above
        console.error("Error re-loading/re-parsing settings:", err);
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
    tray.setToolTip('dePWNer is Active ✅')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
        if (win.isVisible()) {
            win.hide()
        } else {
            win.show()
        }
    });


    createWindow()

    win.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            win.hide();
            new Notification({
                title: "dePWNer is still Active",
                body: "Active in the background, you can go to system tray to Quit",
                silent: true
            }).show()
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
