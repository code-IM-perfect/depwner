#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const process = require("process");
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { showThreatNotification, showScanStartNotification, showScanCompleteNotification, showScanStartNotificationFile } = require('./notifications.cjs');
const csv = require("csv-parser");
const os = require("os");
const dataDir = path.join(os.homedir(), "dePWNer"); // Use the same data directory as in electron.cjs

const hashFilePath = path.join(dataDir, "hash.csv");
const infoFilePath = path.join(dataDir, "info.json");
const QUARANTINE_JSON = "quarantine.json";
const QUARANTINE_DIR = "quarantine";

function getDirectoryNameForHash(targetHash) {
    return new Promise((resolve, reject) => {
        let foundDirectory = null;
        fs.createReadStream(hashFilePath)
            .pipe(csv())
            .on("data", (row) => {
                console.log(targetHash, row["MD5 Hash"])
                if (row["MD5 Hash"] === targetHash) {
                    foundDirectory = row["Directory Name"];

                }
            })
            .on("end", () => resolve(foundDirectory))
            .on("error", (err) => reject(err));
    });
}

function getMalwareInfo(directoryName) {
    try {
        const data = JSON.parse(fs.readFileSync(infoFilePath, "utf8"));
        return data.find((entry) => entry.name === directoryName) || null;
    } catch (err) {
        console.error("Error reading info.json:", err);
        return null;
    }
}

function restoreFileByPath(originalPath) {
    try {
        // Load quarantine.json
        const quarantineData = JSON.parse(fs.readFileSync(QUARANTINE_JSON, "utf8"));

        // Find the file entry by original path
        const fileIndex = quarantineData.findIndex(entry => entry.oldPath === originalPath);
        if (fileIndex === -1) {
            console.log(`File with path ${originalPath} not found in quarantine.`);
            return false;
        }

        const fileEntry = quarantineData[fileIndex];
        const quarantinedFilePath = path.join(QUARANTINE_DIR, fileEntry.name);

        // Ensure the original directory exists before restoring
        const originalDir = path.dirname(fileEntry.oldPath);
        if (!fs.existsSync(originalDir)) {
            fs.mkdirSync(originalDir, { recursive: true });
        }

        // Move file back to its original location
        fs.renameSync(quarantinedFilePath, fileEntry.oldPath);
        console.log(`Restored ${fileEntry.name} to ${fileEntry.oldPath}`);

        // Remove the entry from quarantine.json
        quarantineData.splice(fileIndex, 1);
        fs.writeFileSync(QUARANTINE_JSON, JSON.stringify(quarantineData, null, 2), "utf8");

        return true;
    } catch (error) {
        console.error(`Error restoring file: ${error.message}`);
        return false;
    }
}

function deleteFromQuarantineByPath(originalPath) {
    try {
        // Load quarantine.json
        const quarantineData = JSON.parse(fs.readFileSync(QUARANTINE_JSON, "utf8"));

        // Find the file entry by original path
        const fileIndex = quarantineData.findIndex(entry => entry.oldPath === originalPath);
        if (fileIndex === -1) {
            console.log(`File with path ${originalPath} not found in quarantine.`);
            return false;
        }

        const fileEntry = quarantineData[fileIndex];
        const quarantinedFilePath = path.join(QUARANTINE_DIR, fileEntry.name);

        // Delete the file from the quarantine folder if it exists
        if (fs.existsSync(quarantinedFilePath)) {
            fs.unlinkSync(quarantinedFilePath);
            console.log(`Deleted ${fileEntry.name} from quarantine.`);
        } else {
            console.log(`File ${fileEntry.name} not found in quarantine folder.`);
        }

        // Remove the entry from quarantine.json
        quarantineData.splice(fileIndex, 1);
        fs.writeFileSync(QUARANTINE_JSON, JSON.stringify(quarantineData, null, 2), "utf8");

        return true;
    } catch (error) {
        console.error(`Error deleting file: ${error.message}`);
        return false;
    }


}

function getWhitelistPath(scannerDir) {
    if (!scannerDir) {
        console.error("scannerDir is undefined in getWhitelistPath");
        return '';
    }
    console.log("Getting whitelist path for scannerDir:", scannerDir);
    const whitelistPath = global.settings?.yara
        ? path.join(scannerDir, 'whitelist.txt')
        : path.join(scannerDir, 'over_whitelist.txt');
    console.log("Selected whitelist path:", whitelistPath);
    return whitelistPath;
}

function loadWhitelist(scannerDir) {

    const whitelistPath = getWhitelistPath(scannerDir);
    console.log("Loading whitelist..." + whitelistPath);
    const whitelist = new Set();

    if (fs.existsSync(whitelistPath)) {
        const content = fs.readFileSync(whitelistPath, 'utf-8');
        content.split('\n').forEach(line => {
            const hash = line.trim();
            if (hash) whitelist.add(hash);
        });
        console.log(`Loaded ${whitelist.size} whitelist hashes from ${whitelistPath}`);
    }
    return whitelist;
}

function addToWhitelist(hash, scannerDir) {  // Add scannerDir parameter
    if (!hash) {
        console.error("Cannot add empty hash to whitelist");
        return;
    }
    const whitelistPath = getWhitelistPath(scannerDir);
    if (!whitelistPath) {
        console.error("Could not determine whitelist path");
        return;
    }
    console.log(`Adding hash ${hash} to whitelist at ${whitelistPath}`);

    // Create directory if it doesn't exist
    const dir = path.dirname(whitelistPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Create file if it doesn't exist
    if (!fs.existsSync(whitelistPath)) {
        fs.writeFileSync(whitelistPath, '');
    }

    try {
        fs.appendFileSync(whitelistPath, hash + '\n');
        console.log(`Successfully added hash ${hash} to whitelist`);
    } catch (err) {
        console.error(`Failed to write to whitelist: ${err}`);
    }
}

// const PATHS = {
//     db: path.join(__dirname, 'data', 'malware_hashes.db')
// };

async function printDatabaseContents(db) {
    try {
        const rows = await db.allAsync('SELECT * FROM malware_hashes LIMIT 5');
        console.log('\nFirst 5 rows in database:');
        console.table(rows);
        return rows;
    } catch (err) {
        console.error('Error reading database:', err);
        return [];
    }
}

// Add CSV parsing function for initialization
function importCsvToDb(db, csvPath) {
    console.log("Importing CSV data to SQLite...");
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');

    // Begin transaction for faster inserts
    db.exec('BEGIN TRANSACTION');

    const insertStmt = db.prepare('INSERT OR IGNORE INTO malware_hashes (md5_hash, first_seen_utc, signature) VALUES (?, ?, ?)');

    let headerProcessed = false;
    let md5Index, firstSeenIndex, signatureIndex;
    let count = 0;

    lines.forEach((line) => {
        if (!headerProcessed) {
            const header = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, '').toLowerCase());
            md5Index = header.indexOf('md5_hash');
            firstSeenIndex = header.indexOf('first_seen_utc');
            signatureIndex = header.indexOf('signature');
            headerProcessed = true;
            return;
        }

        if (!line.trim()) return;

        const row = line.split(',');
        const md5Hash = row[md5Index]?.trim().replace(/^["']|["']$/g, '');
        const firstSeen = row[firstSeenIndex]?.trim().replace(/^["']|["']$/g, '') || '';
        const signature = row[signatureIndex]?.trim().replace(/^["']|["']$/g, '') || '';

        if (md5Hash) {
            insertStmt.run(md5Hash, firstSeen, signature);
            count++;
        }
    });

    db.exec('COMMIT');
    console.log(`Imported ${count} records from CSV`);
}

// Modified loadCsvToBloom to handle both DB and CSV
async function loadCsvToBloom(dbPath) {
    if (global.dbConnection) {
        console.log("Using existing DB connection");
        return global.dbConnection;
    }

    try {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err && err.code === 'SQLITE_NOTADB') {
                // If file doesn't exist or not a DB, create new one
                console.log("Creating new database...");
            } else if (err) {
                throw err;
            }
        });

        // Promisify database methods
        db.getAsync = promisify(db.get).bind(db);
        db.runAsync = promisify(db.run).bind(db);
        db.allAsync = promisify(db.all).bind(db);

        // Create table
        await db.runAsync(`
      CREATE TABLE IF NOT EXISTS malware_hashes (
        md5_hash TEXT PRIMARY KEY,
        first_seen_utc TEXT,
        signature TEXT
      )
    `);

        // Check if we need to import CSV data
        const count = await db.getAsync('SELECT COUNT(*) as count FROM malware_hashes');
        if (count.count === 0 && dbPath.endsWith('.csv')) {
            // If DB is empty and we were given a CSV file, import it
            importCsvToDb(db, dbPath);
        }

        const countRow = await db.getAsync('SELECT COUNT(*) as count FROM malware_hashes');
        console.log(`Loaded ${countRow.count} hashes from SQLite database`);

        await printDatabaseContents(db);

        global.dbConnection = {
            db,
            async checkHash(hash) {
                console.log(`Checking hash in database: ${hash}`);
                const quotedHash = `"${hash}"`;
                return new Promise((resolve, reject) => {
                    db.get('SELECT * FROM malware_hashes WHERE md5_hash = ? OR md5_hash = ?',
                        [hash, quotedHash],
                        (err, row) => {
                            if (err) {
                                console.error('Database query error:', err);
                                reject(err);
                                return;
                            }
                            if (row) {
                                console.log(`Match found: ${JSON.stringify(row)}`);
                                row.signature = row.signature?.replace(/^"|"$/g, '') || '';
                                resolve({
                                    signature: row.signature,
                                    first_seen: row.first_seen_utc
                                });
                            } else {
                                console.log('No match found');
                                resolve(null);
                            }
                        });
                });
            }
        };

        const sampleRows = await db.allAsync('SELECT md5_hash, signature FROM malware_hashes LIMIT 3');
        console.log('\nSample database entries:');
        sampleRows.forEach(row => {
            console.log(`Hash: ${row.md5_hash}, Signature: ${row.signature}`);
        });

        return global.dbConnection;
    } catch (err) {
        console.error('Error initializing SQLite:', err);
        throw err;
    }
}

function computeHashes(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        const md5 = crypto.createHash("md5").update(data).digest("hex").toLowerCase();
        return { md5 };
    } catch (err) {
        console.error(`Error reading file ${filePath}: ${err}`);
        return null;
    }
}

function runYaraScan(filePath, rulesPath = "./output.yarc") {
    if (!global.settings?.yara) {
        return null;
    }

    try {
        let cmd;
        if (process.platform == 'windows') {
            cmd = path.join(__dirname, "yr.exe");
        } else {
            cmd = path.join(__dirname, "yr");
        }
        console.log(cmd);
        const args = ["scan", "-C", rulesPath, filePath];
        console.log(args);
        const result = spawnSync(cmd, args, { encoding: "utf-8" });
        console.log("YARA scan result:", result);
        if (result.status === 0 && result.stdout.trim()) {
            return result.stdout.trim();
        }
        return null;
    } catch (err) {
        console.error(`YARA scan error: ${err}`);
        return null;
    }
}

function moveToQuarantine(filePath, options = {}) {  // Add options parameter
    if (!options.dataDir) {
        console.error("dataDir is required for quarantine operations");
        return null;
    }

    const quarantinePath = path.join(options.dataDir, './quarantine');
    if (!fs.existsSync(quarantinePath)) {
        fs.mkdirSync(quarantinePath, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const newPath = path.join(quarantinePath, fileName);

    try {
        fs.renameSync(filePath, newPath);
        return newPath;
    } catch (err) {
        console.error(`Failed to move file to quarantine: ${err}`);
        return null;
    }
}

function updateQuarantineJson(fileInfo, options = {}) {
    if (!options.dataDir) {
        console.error("dataDir is required for quarantine operations");
        return;
    }

    const quarantineJsonPath = path.join(options.dataDir, './quarantine.json');
    let quarantineList = [];

    try {
        if (fs.existsSync(quarantineJsonPath)) {
            const content = fs.readFileSync(quarantineJsonPath, 'utf-8').trim();
            if (content) {
                quarantineList = JSON.parse(content);
            }
        }
    } catch (err) {
        console.error("Error reading quarantine.json:", err);
        quarantineList = [];
    }

    quarantineList.push(fileInfo);
    fs.writeFileSync(quarantineJsonPath, JSON.stringify(quarantineList, null, 2));
}

async function scanFile(filePath, dbConnection, yaraRules, options = {}, logAndNotify = true) {
    const whitelist = loadWhitelist(options.scannerDir);
    const hashes = computeHashes(filePath);  // Move this up

    console.log(`\nScanning file: ${filePath}`);
    console.log(`Computed MD5: ${hashes?.md5 || 'failed to compute hash'}`);
    if (logAndNotify) {
        showScanStartNotificationFile();
    }
    if (!hashes) {
        return { matched: false, result: "hash_error" };
    }

    // Rest of the function remains the same...
    console.log('Checking whitelist...');
    if (whitelist.has(hashes.md5)) {
        console.log('File is whitelisted');
        if (logAndNotify) {
            showNotification(true);
            logScanResult(filePath, true, options);
        }
        return {
            matched: false,
            result: {
                type: "whitelist",
                hash: hashes.md5,
                file: filePath,
            },
        };
    }
    const directoryName = await getDirectoryNameForHash(hashes.md5);
    console.log("dir name:", directoryName);
    if (!directoryName) {
        console.log("No matching directory found for hash:", hashes.md5);
    }

    const malwareInfo = getMalwareInfo(directoryName);
    if (!malwareInfo) {
        console.log("No malware info found for directory:", directoryName);
    }
    if (malwareInfo) {
        const quarantinePath = moveToQuarantine(filePath, options);  // Pass options
        if (quarantinePath) {
            const detectionTechniques = malwareInfo?.detailed_analysis?.detection_techniques;
            const data = {
                name: path.basename(filePath),
                type: directoryName,
                oldPath: filePath,
                hash: hashes.md5,
                description: malwareInfo?.description,
                cve_scores: malwareInfo?.detailed_analysis?.cve_scores,
                history: malwareInfo?.detailed_analysis?.history,
                origin: malwareInfo?.detailed_analysis?.origin,
                authorship: malwareInfo?.detailed_analysis?.authorship,
                affected_nations: malwareInfo?.detailed_analysis?.affected_nations,
            };
            if (typeof detectionTechniques === "object") {
                data.predictive_detection_techniques = detectionTechniques.predictive || "N/A";
                data.behavior_based_detection_techniques = detectionTechniques.behavior_based || "N/A";
            } else {
                data.detection_techniques = detectionTechniques;
            }

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
            );

            if (Object.keys(filteredData).length > 0) {
                updateQuarantineJson(filteredData, options);
            }
            if (logAndNotify) {
                showThreatNotification(path.basename(filePath), directoryName);
                showNotification(false);
                logScanResult(filePath, false, options);
            }
            return {
                matched: true,
                result: {
                    type: "primary_bloom",
                    hash_type: "md5",
                    hash: hashes.md5,
                    signature: directoryName,
                    file: filePath,
                    quarantined: !!quarantinePath
                },
            };
        }
    }

    if (dbConnection) {
        console.log('Checking database for hash match...');
        const match = await dbConnection.checkHash(hashes.md5);
        console.log(`Database match result: ${match ? 'Found' : 'Not found'}`);

        if (match) {
            console.log(`Match details: ${JSON.stringify(match)}`);
            const quarantinePath = moveToQuarantine(filePath, options);  // Pass options
            if (quarantinePath) {
                updateQuarantineJson({
                    name: path.basename(filePath),
                    type: match.signature || "Unknown",
                    oldPath: filePath,
                    hash: hashes.md5,
                    yaraRule: "",
                    severity: "",
                }, options);
            }

            if (logAndNotify) {
                showThreatNotification(path.basename(filePath), match.signature);
                showNotification(false);
                logScanResult(filePath, false, options);
            }
            return {
                matched: true,
                result: {
                    type: "primary_bloom",
                    hash_type: "md5",
                    hash: hashes.md5,
                    first_seen: match.first_seen,
                    signature: match.signature,
                    file: filePath,
                    quarantined: !!quarantinePath
                },
            };
        }
    }

    if (!dbConnection) {
        const yaraResult = runYaraScan(filePath, yaraRules);
        if (yaraResult) {
            const quarantinePath = moveToQuarantine(filePath, options);  // Pass options
            if (quarantinePath) {
                updateQuarantineJson({
                    name: path.basename(filePath),
                    type: "YARA Detection",
                    oldPath: filePath,
                    hash: hashes.md5,
                    yaraRule: yaraResult,
                    severity: "",
                }, options);
            }

            if (logAndNotify) {
                showThreatNotification(path.basename(filePath), "YARA Detection");
                showNotification(false);
                logScanResult(filePath, false, options);
            }
            return {
                matched: true,
                result: {
                    type: "yara",
                    matches: yaraResult,
                    file: filePath,
                    quarantined: !!quarantinePath
                },
            };
        }
        return { matched: false, result: null };
    }

    // const yaraResult = runYaraScan(filePath, yaraRules);
    // if (yaraResult) {
    //     const quarantinePath = moveToQuarantine(filePath, options);  // Pass options
    //     if (quarantinePath) {
    //         updateQuarantineJson({
    //             name: path.basename(filePath),
    //             type: "YARA Detection",
    //             oldPath: filePath,
    //             hash: hashes.md5,
    //             yaraRule: yaraResult,
    //             severity: "",
    //         }, options);
    //     }
    //     showThreatNotification(
    //         path.basename(filePath),
    //         match.signature
    //     );
    //     return {
    //         matched: true,
    //         result: {
    //             type: "yara",
    //             matches: yaraResult,
    //             file: filePath,
    //             quarantined: !!quarantinePath
    //         },
    //     };
    // }

    if (logAndNotify) {
        showNotification(true);
        logScanResult(filePath, true, options);
    }
    addToWhitelist(hashes.md5, options.scannerDir);
    return {
        matched: false,
        result: {
            type: "new_whitelist",
            hash: hashes.md5,
            file: filePath,
        },
    };

}

function getAllFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    }

    global.scanStatus.filesToScan = results.lenmgth;
    return results;
}

async function scanFolder(folder, dbConnection, yaraRules, options = {}) {
    const allFiles = getAllFiles(folder);

    if (allFiles.length === 0) {
        console.log(JSON.stringify({ error: "No files found to scan." }, null, 2));
        return;
    }

    const totalFiles = allFiles.length;
    showScanStartNotification(totalFiles);

    const results = {
        scan_summary: {
            total_files: totalFiles,
            matches: {
                primary_bloom: 0,
                yara: 0,
            },
            whitelisted: 0,
            new_whitelisted: 0,
        },
        matched_files: [],
        whitelisted_files: [],
        new_whitelisted_files: [],
    };

    console.log(`Scanning ${totalFiles} files...`);
    let count = 0;
    for (const filePath of allFiles) {
        let scanResult = await scanFile(filePath, dbConnection, yaraRules, options, false);
        global.scanStatus.currentFile = filePath;

        if (scanResult.result?.type === "whitelist") {
            results.scan_summary.whitelisted++;
            results.whitelisted_files.push(scanResult.result);
        } else if (scanResult.result?.type === "new_whitelist") {
            results.scan_summary.new_whitelisted++;
            results.new_whitelisted_files.push(scanResult.result);
        } else if (scanResult.matched) {
            results.scan_summary.matches[scanResult.result.type] += 1;
            results.matched_files.push(scanResult.result);

            // global.scanStatus.threatsFound.push(scanResult.result.file);

            // Show notification for detected threat
            // showThreatNotification(
            //   path.basename(scanResult.result.file),
            //   scanResult.result.quarantined
            // );

            ////////////////////////////////////////////////
            ///////// NOTIFICATION /////////////////////////
            ////////////////////////////////////////////////
        }

        count++;
        global.scanStatus.progress = count;
        process.stdout.write(`\rScanned: ${count}/${totalFiles}`);
    }

    // Fix the logs file path handling
    if (options.dataDir) {
        const logsFile = path.join(options.dataDir, './logs.json');
        try {
            let logs = [];
            if (fs.existsSync(logsFile)) {
                logs = JSON.parse(fs.readFileSync(logsFile, 'utf-8'));
            }
            const newLogEntry = {
                scanType: global.scanStatus?.type || 'unknown',
                filesScanned: totalFiles,
                threats: results.matched_files.length,
                time: Date.now(),
                folder: folder
            };
            logs.push(newLogEntry);
            fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
        } catch (err) {
            console.error("Error writing to logs file:", err);
        }
    }

    global.scanStatus.status = 'completed';

    const totalMatches = Object.values(results.scan_summary.matches).reduce((a, b) => a + b, 0);
    results.scan_summary.total_matches = totalMatches;
    results.scan_summary.match_percentage = totalFiles > 0 ? (totalMatches / totalFiles) * 100 : 0;

    showScanCompleteNotification(
        totalFiles,
        results.scan_summary.total_matches
    );

    console.log(JSON.stringify(results, null, 2));
    return results;
}

function logScanResult(filePath, status, options) {
    if (options.dataDir) {
        const logsFile = path.join(options.dataDir, 'logs.json');
        try {
            let logs = [];
            if (fs.existsSync(logsFile)) {
                logs = JSON.parse(fs.readFileSync(logsFile, 'utf-8'));
            }

            logs.push({
                scanType: global.scanStatus?.type || 'unknown',
                filesScanned: 1,
                threats: status ? 0 : 1,
                time: Date.now(),
                folder: path.dirname(filePath)
            });

            fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
            console.log("Log entry added successfully!");
        } catch (err) {
            console.error("Error writing to logs file:", err);
        }
    }
}

function showNotification(files) {
    showScanCompleteNotification(1, files ? 0 : 1);
}
function formatMem(usage) {
    const mb = x => (x / (1024 * 1024)).toFixed(2) + " MB";
    return {
        rss: mb(usage.rss),
        heapTotal: mb(usage.heapTotal),
        heapUsed: mb(usage.heapUsed),
        external: mb(usage.external),
        arrayBuffers: mb(usage.arrayBuffers || 0)
    }; filesTo
}

async function scanInput(options) {
    if (!options.filePath && !options.folderPath) {
        throw new Error("Either filePath or folderPath option is required");
    }

    if (!options.whitelistPath) {
        console.log("No whitelist path provided, using default whitelist location");
    }

    const startTime = Date.now();
    console.log("Initial Memory Usage:", formatMem(process.memoryUsage()));
    console.log(global.quarantine);

    let dbConnection = null;

    if (options.dbPath) {
        dbConnection = await loadCsvToBloom(options.dbPath);
        console.log("Database connected, ready to scan");
    } else {
        console.log("No database provided, using YARA-only scan");
    }

    const yaraRules = options.yaraPath || "./output.yarc";

    let results;

    if (options.filePath) {
        results = await scanFile(
            options.filePath,
            dbConnection,
            yaraRules,
            options
        );
    } else {
        console.log("Hello this is me" + options.folderPath);
        results = await scanFolder(
            options.folderPath,
            dbConnection,
            yaraRules,
            options
        );
    }
    console.log("Yara status" + global.settings.yara);

    console.log("Scan completed in", (Date.now() - startTime) / 1000, "seconds");
    console.log("Final Memory Usage:", formatMem(process.memoryUsage()));
    return results;
}

module.exports = {
    loadCsvToBloom,
    scanInput
};

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        let dbPath = null, yaraPath = "./output.yarc", filePath = null, folderPath = null, whitelistPath = null;

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--db":
                    dbPath = args[++i];
                    break;
                case "--yara":
                    yaraPath = args[++i];
                    break;
                case "--file":
                    filePath = args[++i];
                    break;
                case "--folder":
                    folderPath = args[++i];
                    break;
                case "--whitelist":
                    whitelistPath = args[++i];
                    break;
                default:
                    console.error(`Unknown argument: ${args[i]}`);
                    process.exit(1);
            }
        }

        try {
            const result = await scanInput({ dbPath, yaraPath, filePath, folderPath, whitelistPath });
            console.log(dbPath);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    })();
}
