import { LogEntry, LogLevel, ScanLogEntry, ScanStatus } from '@domain/models/LogEntry';

interface FileSystemDriver {
  isRNFS: boolean;
  baseDir: string;
  writeFile: (filePath: string, content: string) => Promise<void>;
  appendFile: (filePath: string, content: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string>;
  exists: (filePath: string) => Promise<boolean>;
  unlink: (filePath: string) => Promise<void>;
  mkdir: (dirPath: string) => Promise<void>;
}

function getFileSystemDriver(): FileSystemDriver | null {
  // Check if React Native FS is available (mobile environment)
  const isReactNative =
    typeof (global as any).__fbBatchedBridge !== 'undefined' ||
    !(typeof process !== 'undefined' && process.versions?.node);

  if (isReactNative) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const rnfsMod = require('react-native-fs');
      const rnfs = rnfsMod.default || rnfsMod;
      if (rnfs && rnfs.DocumentDirectoryPath) {
        const baseDir = `${rnfs.DocumentDirectoryPath}/logs`;
        return {
          isRNFS: true,
          baseDir,
          writeFile: (p, c) => rnfs.writeFile(p, c, 'utf8'),
          appendFile: async (p, c) => {
            const fileExists = await rnfs.exists(p);
            if (fileExists) {
              await rnfs.appendFile(p, c, 'utf8');
            } else {
              await rnfs.writeFile(p, c, 'utf8');
            }
          },
          readFile: (p) => rnfs.readFile(p, 'utf8'),
          exists: (p) => rnfs.exists(p),
          unlink: (p) => rnfs.unlink(p),
          mkdir: (d) => rnfs.mkdir(d),
        };
      }
    } catch {}
  }

  // Node environment fallback for unit tests and local runs
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const os = require('os');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pathMod = require('path');
      const baseDir = pathMod.join(os.tmpdir(), 'qrmanager_logs');
      return {
        isRNFS: false,
        baseDir,
        writeFile: async (p, c) => fs.promises.writeFile(p, c, 'utf8'),
        appendFile: async (p, c) => fs.promises.appendFile(p, c, 'utf8'),
        readFile: async (p) => fs.promises.readFile(p, 'utf8'),
        exists: async (p) => {
          try {
            await fs.promises.access(p);
            return true;
          } catch {
            return false;
          }
        },
        unlink: async (p) => {
          try {
            await fs.promises.unlink(p);
          } catch {}
        },
        mkdir: async (d) => fs.promises.mkdir(d, { recursive: true }),
      };
    } catch {}
  }

  return null;
}

const MAX_IN_MEMORY_LOGS = 100;
const LOG_FILE_NAME = 'app.log';

export class AppLogger {
  private static appLogs: LogEntry[] = [];
  private static scanLogs: ScanLogEntry[] = [];
  private static isInitialized = false;

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Return the absolute path to the local persistent log file in application storage.
   */
  static getLogFilePath(): string | null {
    const fs = getFileSystemDriver();
    if (!fs) return null;
    return `${fs.baseDir}/${LOG_FILE_NAME}`;
  }

  private static async ensureLogDir(): Promise<FileSystemDriver | null> {
    const fs = getFileSystemDriver();
    if (!fs) return null;
    try {
      const exists = await fs.exists(fs.baseDir);
      if (!exists) {
        await fs.mkdir(fs.baseDir);
      }
      return fs;
    } catch {
      return null;
    }
  }

  /**
   * Initialize the persistent logger.
   * Loads existing logs from application storage into memory so logs persist across restarts.
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const fs = await this.ensureLogDir();
      if (fs) {
        // Load scan history from application storage
        const scanFilePath = `${fs.baseDir}/scan_history.json`;
        if (await fs.exists(scanFilePath)) {
          const content = await fs.readFile(scanFilePath);
          const loaded = JSON.parse(content);
          if (Array.isArray(loaded)) {
            this.scanLogs = loaded.slice(0, MAX_IN_MEMORY_LOGS);
          }
        }

        // Load structured application events from application storage
        const appLogFilePath = `${fs.baseDir}/app_events.json`;
        if (await fs.exists(appLogFilePath)) {
          const content = await fs.readFile(appLogFilePath);
          const loaded = JSON.parse(content);
          if (Array.isArray(loaded)) {
            this.appLogs = loaded.slice(0, MAX_IN_MEMORY_LOGS);
          }
        }

        // Ensure persistent app.log file exists
        const logFilePath = `${fs.baseDir}/${LOG_FILE_NAME}`;
        if (!(await fs.exists(logFilePath))) {
          const header = `=== QR Manager Application Log Started: ${new Date().toISOString()} ===\n`;
          await fs.writeFile(logFilePath, header);
        } else {
          // Record session restart milestone in persistent log file
          const restartMarker = `[${new Date().toISOString()}] [INFO] [AppLogger] Application initialized (session restored)\n`;
          await fs.appendFile(logFilePath, restartMarker);
        }
      }
    } catch (e) {
      console.warn('AppLogger.init error:', e);
    }
  }

  private static persistScanLogs(): void {
    (async () => {
      try {
        const fs = await this.ensureLogDir();
        if (!fs) return;
        await fs.writeFile(`${fs.baseDir}/scan_history.json`, JSON.stringify(this.scanLogs, null, 2));
      } catch (err) {
        console.warn('Failed to persist scan logs:', err);
      }
    })();
  }

  private static persistAppLogs(latestEntry?: LogEntry): void {
    (async () => {
      try {
        const fs = await this.ensureLogDir();
        if (!fs) return;

        // Persist structured JSON buffer for quick retrieval
        await fs.writeFile(`${fs.baseDir}/app_events.json`, JSON.stringify(this.appLogs, null, 2));

        // Append line to persistent human-readable local log file (app.log)
        if (latestEntry) {
          const logFilePath = `${fs.baseDir}/${LOG_FILE_NAME}`;
          let line = `[${latestEntry.timestamp}] [${latestEntry.level}] [${latestEntry.tag}] ${latestEntry.message}`;
          if (latestEntry.details) {
            line += ` | Details: ${typeof latestEntry.details === 'string' ? latestEntry.details : JSON.stringify(latestEntry.details)}`;
          }
          if (latestEntry.errorStack) {
            line += `\n${latestEntry.errorStack}`;
          }
          line += '\n';

          await fs.appendFile(logFilePath, line);
        }
      } catch (err) {
        console.warn('Failed to persist app logs:', err);
      }
    })();
  }

  private static addLog(level: LogLevel, tag: string, message: string, details?: any, errorStack?: string): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      tag,
      message,
      details,
      errorStack,
    };

    this.appLogs.unshift(entry);
    if (this.appLogs.length > MAX_IN_MEMORY_LOGS) {
      this.appLogs.pop();
    }

    // Echo to console for metro / logcat debugging
    const logPrefix = `[${entry.timestamp}] [${level}] [${tag}] ${message}`;
    if (level === 'ERROR') {
      console.error(logPrefix, details ?? '', errorStack ?? '');
    } else if (level === 'WARN') {
      console.warn(logPrefix, details ?? '');
    } else {
      console.log(logPrefix, details ?? '');
    }

    this.persistAppLogs(entry);
    return entry;
  }

  /**
   * Log fine-grained diagnostic messages for troubleshooting.
   */
  static debug(tag: string, message: string, details?: any): void {
    this.addLog('DEBUG', tag, message, details);
  }

  /**
   * Log informational milestone messages.
   */
  static info(tag: string, message: string, details?: any): void {
    this.addLog('INFO', tag, message, details);
  }

  /**
   * Log warning events indicating non-fatal anomalies.
   */
  static warn(tag: string, message: string, details?: any): void {
    this.addLog('WARN', tag, message, details);
  }

  /**
   * Log error events with error details and stack trace.
   */
  static error(tag: string, message: string, error?: any, details?: any): void {
    let errorStack: string | undefined;
    let errorMessage = message;

    if (error instanceof Error) {
      errorStack = error.stack;
      errorMessage = `${message}: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = `${message}: ${error}`;
    } else if (error && typeof error === 'object') {
      errorMessage = `${message}: ${JSON.stringify(error)}`;
    }

    this.addLog('ERROR', tag, errorMessage, details, errorStack);
  }

  /**
   * Log an incoming QR scan attempt and its initial intent.
   * Returns a unique scan ID used to track subsequent transformations.
   */
  static async logScan(entry: Omit<ScanLogEntry, 'id' | 'timestamp'>): Promise<string> {
    const scanId = this.generateId();
    const newEntry: ScanLogEntry = {
      ...entry,
      id: scanId,
      timestamp: new Date().toISOString(),
    };

    this.scanLogs.unshift(newEntry);
    if (this.scanLogs.length > MAX_IN_MEMORY_LOGS) {
      this.scanLogs.pop();
    }

    this.info('ScanLogger', `Scanned QR (${newEntry.source}): ${newEntry.scannedIntent}`, {
      scanId,
      status: newEntry.status,
      scannedIntent: newEntry.scannedIntent,
    });

    this.persistScanLogs();
    return scanId;
  }

  /**
   * Update an existing scan log entry with transformation details or payment results.
   */
  static async updateScan(scanId: string, updates: Partial<ScanLogEntry>): Promise<void> {
    const existing = this.scanLogs.find((s) => s.id === scanId);
    if (existing) {
      Object.assign(existing, updates);

      if (updates.transformedIntent) {
        this.info('ScanLogger', `Transformed intent for scan ${scanId}: ${updates.transformedIntent}`, {
          scanId,
          scannedIntent: existing.scannedIntent,
          transformedIntent: updates.transformedIntent,
          status: existing.status,
        });
      }

      if (updates.status === 'PAYMENT_FAILED' || updates.status === 'PARSE_FAILED') {
        this.error('ScanLogger', `Scan ${scanId} failed (${updates.status})`, updates.errorMessage, {
          scanId,
          scannedIntent: existing.scannedIntent,
          transformedIntent: existing.transformedIntent,
        });
      }

      this.persistScanLogs();
    }
  }

  /**
   * Retrieve all recorded scan history (scanned intent & transformed intent).
   */
  static async getScanLogs(): Promise<ScanLogEntry[]> {
    return [...this.scanLogs];
  }

  /**
   * Retrieve all recorded application logs and errors.
   */
  static async getAppLogs(): Promise<LogEntry[]> {
    return [...this.appLogs];
  }

  /**
   * Read the raw contents of the persistent application log file (app.log).
   */
  static async readLogFile(): Promise<string> {
    const fs = await this.ensureLogDir();
    if (!fs) return '';
    const logFilePath = `${fs.baseDir}/${LOG_FILE_NAME}`;
    if (!(await fs.exists(logFilePath))) return '';
    return fs.readFile(logFilePath);
  }

  /**
   * Export all logs into a single readable string for debugging or sharing.
   */
  static async exportLogs(): Promise<string> {
    const logFilePath = this.getLogFilePath();
    let rawLogExcerpt = '';
    try {
      const content = await this.readLogFile();
      rawLogExcerpt = content.slice(-10000); // Last 10KB of app.log
    } catch {}

    const report = {
      exportedAt: new Date().toISOString(),
      logFilePath,
      scanCount: this.scanLogs.length,
      appLogCount: this.appLogs.length,
      scanHistory: this.scanLogs,
      recentLogs: this.appLogs,
      rawLogExcerpt,
    };
    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear all stored in-memory and persisted log files.
   */
  static async clearAllLogs(): Promise<void> {
    this.appLogs = [];
    this.scanLogs = [];

    const fs = await this.ensureLogDir();
    if (fs) {
      await fs.unlink(`${fs.baseDir}/scan_history.json`);
      await fs.unlink(`${fs.baseDir}/app_events.json`);
      await fs.unlink(`${fs.baseDir}/${LOG_FILE_NAME}`);
    }
  }

  /**
   * Test helper to reset in-memory state and simulate app restart.
   */
  static resetForTesting(): void {
    this.appLogs = [];
    this.scanLogs = [];
    this.isInitialized = false;
  }
}

