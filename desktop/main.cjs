const { app, BrowserWindow, ipcMain, safeStorage, shell, utilityProcess } = require('electron');
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const isDevelopment = Boolean(process.env.ELECTRON_START_URL);
const legacyLocalApiBaseUrl = 'http://127.0.0.1:5500/api';
const defaultApiBaseUrl = 'https://digitnp.com/api';
const resolveApiBaseUrl = (configuredApiBaseUrl) => {
  const candidate = (process.env.DIGIT_DESKTOP_API_BASE_URL || process.env.VITE_API_URL || configuredApiBaseUrl || defaultApiBaseUrl).replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('DIGIT_DESKTOP_API_BASE_URL must be a valid HTTP(S) URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('The desktop API URL must use HTTP or HTTPS.');
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (!isDevelopment && !isLoopback && parsed.protocol !== 'https:') {
    throw new Error('A packaged desktop app requires HTTPS for a non-local API.');
  }

  return candidate;
};

let apiBaseUrl = defaultApiBaseUrl;
let apiHealthUrl = `${defaultApiBaseUrl}/health`;
let backendPort = '5500';
let shouldUseLocalBackend = true;
let desktopConfig;

const initializeApiConfiguration = (configuredApiBaseUrl) => {
  apiBaseUrl = resolveApiBaseUrl(configuredApiBaseUrl);
  apiHealthUrl = `${apiBaseUrl}/health`;
  const localApiUrl = new URL(apiBaseUrl);
  backendPort = localApiUrl.port || (localApiUrl.protocol === 'https:' ? '443' : '80');
  shouldUseLocalBackend =
    ['localhost', '127.0.0.1', '::1'].includes(localApiUrl.hostname) &&
    process.env.DIGIT_DESKTOP_LAUNCH_BACKEND !== 'false';
  process.env.DIGIT_DESKTOP_API_BASE_URL = apiBaseUrl;
};

let mainWindow;
let backendProcess;
let lastBackendError = '';
let backendStartedByDesktop = false;
let logFilePath = '';

const writeLog = (level, ...values) => {
  if (!logFilePath) return;
  const serialized = values.map((value) => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }).join(' ');

  try {
    fs.appendFileSync(logFilePath, `${new Date().toISOString()} [${level}] ${serialized}\n`, 'utf8');
  } catch {
    // Logging must never prevent the POS from opening.
  }
};

const initializeLogging = () => {
  const logsDirectory = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDirectory, { recursive: true });
  logFilePath = path.join(logsDirectory, 'desktop.log');
  writeLog('info', 'Desktop starting', { version: app.getVersion(), apiBaseUrl });
};

const isAllowedExternalUrl = (url) => {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

const getDesktopConfigPath = () => path.join(app.getPath('userData'), 'desktop-config.json');

const readDesktopConfig = async () => {
  const configPath = getDesktopConfigPath();
  try {
    const config = JSON.parse(await fsp.readFile(configPath, 'utf8'));
    let jwtSecret = config.jwtSecret;
    const configuredApiBaseUrl = config.apiBaseUrl === legacyLocalApiBaseUrl
      ? defaultApiBaseUrl
      : config.apiBaseUrl || defaultApiBaseUrl;

    if (config.jwtSecretEncrypted && safeStorage.isEncryptionAvailable()) {
      jwtSecret = safeStorage.decryptString(Buffer.from(config.jwtSecretEncrypted, 'base64'));
    }

    if (!jwtSecret) jwtSecret = crypto.randomBytes(32).toString('hex');

    if (safeStorage.isEncryptionAvailable() && (!config.jwtSecretEncrypted || config.jwtSecret || configuredApiBaseUrl !== config.apiBaseUrl)) {
      const nextConfig = {
        databaseUrl: config.databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/restaurant_pos',
        apiBaseUrl: configuredApiBaseUrl,
        jwtSecretEncrypted: safeStorage.encryptString(jwtSecret).toString('base64')
      };
      await fsp.writeFile(configPath, JSON.stringify(nextConfig, null, 2), { mode: 0o600 });
    } else if (configuredApiBaseUrl !== config.apiBaseUrl) {
      await fsp.writeFile(configPath, JSON.stringify({ ...config, apiBaseUrl: configuredApiBaseUrl, jwtSecret }, null, 2), { mode: 0o600 });
    }

    return { ...config, apiBaseUrl: configuredApiBaseUrl, jwtSecret };
  } catch {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const config = {
      databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/restaurant_pos',
      apiBaseUrl: process.env.DIGIT_DESKTOP_API_BASE_URL || defaultApiBaseUrl
    };
    if (safeStorage.isEncryptionAvailable()) {
      config.jwtSecretEncrypted = safeStorage.encryptString(jwtSecret).toString('base64');
    } else {
      config.jwtSecret = jwtSecret;
    }
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    return { ...config, jwtSecret };
  }
};

const getServerDirectory = () => path.join(app.getAppPath(), 'server');

// An ASAR path is valid for loading modules, but it is not a real OS directory
// and therefore cannot be used as a child process working directory.
const getServerWorkingDirectory = () => app.isPackaged ? process.resourcesPath : getServerDirectory();

const getServerEntry = () => path.join(getServerDirectory(), 'server.js');

const requestJson = (url, timeoutMs = 2500) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, statusCode: response.statusCode, body: JSON.parse(body || '{}') });
        } catch {
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, statusCode: response.statusCode, body });
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Health check timed out'));
    });
    request.on('error', reject);
  });

const checkApiHealth = async () => {
  try {
    const result = await requestJson(apiHealthUrl);
    return {
      ok: result.ok && result.body?.success !== false,
      statusCode: result.statusCode,
      data: result.body?.data || result.body,
      error: ''
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      data: null,
      error: error.message
    };
  }
};

const waitForApi = async (timeoutMs = 30000) => {
  const startedAt = Date.now();
  let status = await checkApiHealth();

  while (!status.ok && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await checkApiHealth();
  }

  return status;
};

const startBackend = async () => {
  if (!shouldUseLocalBackend || backendProcess) return;

  const existingStatus = await checkApiHealth();
  if (existingStatus.ok) return;

  const serverEntry = getServerEntry();
  if (!fs.existsSync(serverEntry)) {
    lastBackendError = `Backend entry not found at ${serverEntry}`;
    return;
  }

  const config = desktopConfig || await readDesktopConfig();
  const uploadsPath = path.join(app.getPath('userData'), 'uploads');
  await fsp.mkdir(uploadsPath, { recursive: true });

  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: backendPort,
    HOST: '127.0.0.1',
    DATABASE_URL: process.env.DATABASE_URL || config.databaseUrl,
    CORE_DATABASE_URL: process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || config.databaseUrl,
    DATABASE_SSL: process.env.DATABASE_SSL || 'false',
    JWT_SECRET: process.env.JWT_SECRET || config.jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    ALLOW_NULL_ORIGIN: 'true',
    TRUST_PROXY: 'loopback',
    UPLOAD_DIR: uploadsPath
  };
  // utilityProcess already provides a Node runtime. Inheriting this legacy flag
  // can make Electron bypass its utility-process bootstrap and lose ICU handles.
  delete env.ELECTRON_RUN_AS_NODE;

  backendProcess = utilityProcess.fork(serverEntry, [], {
    cwd: getServerWorkingDirectory(),
    env,
    stdio: 'pipe',
    serviceName: 'Digit POS Backend'
  });
  backendStartedByDesktop = true;

  backendProcess.stdout?.on('data', (chunk) => {
    const message = chunk.toString().trim();
    console.log(`[desktop-backend] ${message}`);
    writeLog('info', '[desktop-backend]', message);
  });
  backendProcess.stderr?.on('data', (chunk) => {
    lastBackendError = chunk.toString().trim();
    console.error(`[desktop-backend] ${lastBackendError}`);
    writeLog('error', '[desktop-backend]', lastBackendError);
  });
  backendProcess.on('exit', (code) => {
    if (code) lastBackendError = `Backend stopped with exit code ${code}`;
    writeLog(code ? 'error' : 'info', 'Bundled backend exited', { code });
    backendProcess = null;
  });
};

const loadApplication = async (window) => {
  if (isDevelopment) {
    await window.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  await window.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
};

const loadConnectionScreen = async (window) => {
  await window.loadFile(path.join(__dirname, 'status.html'));
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Digit Restaurant Management System',
    backgroundColor: '#f8fafc',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--digit-api-base-url=${apiBaseUrl}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDevelopment,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    writeLog('error', 'Renderer process exited', details);
  });

  return window;
};

const assertDesktopRenderer = (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Desktop printing is only available to the main application window');
  }
};

const installedPrintersFor = async (webContents) => {
  const printers = await webContents.getPrintersAsync();
  return Array.isArray(printers) ? printers : [];
};

const resolveInstalledPrinter = async (webContents, requestedName) => {
  const name = String(requestedName || '').trim();
  if (!name) throw new Error('Printer name is required');
  if (name.length > 255) throw new Error('Printer name is invalid');

  const printers = await installedPrintersFor(webContents);
  const printer = printers.find((candidate) =>
    String(candidate.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (!printer) throw new Error(`Printer named "${name}" is not installed on this computer`);
  return printer.name;
};

const windowsRawPrintScript = `
$source = @'
using System;
using System.Runtime.InteropServices;

public static class DigitRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr printer, int level, [In] DocInfo docInfo);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr printer, byte[] bytes, int count, out int written);
}
'@

Add-Type -TypeDefinition $source -Language CSharp
$printer = [IntPtr]::Zero
$documentStarted = $false
$pageStarted = $false
if (-not [DigitRawPrinter]::OpenPrinter($env:DIGIT_POS_PRINTER_NAME, [ref]$printer, [IntPtr]::Zero)) {
  throw "Unable to open Windows printer queue"
}
try {
  $doc = New-Object DigitRawPrinter+DocInfo
  $doc.pDocName = "Digit POS Ticket"
  $doc.pDataType = "RAW"
  if ([DigitRawPrinter]::StartDocPrinter($printer, 1, $doc) -eq 0) { throw "Unable to start print document" }
  $documentStarted = $true
  if (-not [DigitRawPrinter]::StartPagePrinter($printer)) { throw "Unable to start print page" }
  $pageStarted = $true
  $bytes = [IO.File]::ReadAllBytes($env:DIGIT_POS_PRINT_FILE)
  $written = 0
  if (-not [DigitRawPrinter]::WritePrinter($printer, $bytes, $bytes.Length, [ref]$written)) {
    throw "Windows spooler rejected the print data"
  }
  if ($written -ne $bytes.Length) { throw "Windows spooler accepted only part of the print data" }
} finally {
  if ($pageStarted) { [void][DigitRawPrinter]::EndPagePrinter($printer) }
  if ($documentStarted) { [void][DigitRawPrinter]::EndDocPrinter($printer) }
  if ($printer -ne [IntPtr]::Zero) { [void][DigitRawPrinter]::ClosePrinter($printer) }
}
`;

const printRawTextOnWindows = async (deviceName, text) => {
  const printFilePath = path.join(app.getPath('temp'), `digit-pos-raw-${crypto.randomUUID()}.bin`);
  const normalized = String(text || '').replace(/\r?\n/g, '\r\n').trimEnd();
  const printBytes = Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from(`${normalized}\r\n\r\n\r\n`, 'ascii'),
    // ESC/POS GS V: partial-cut after every independent station ticket.
    // Printers without an automatic cutter ignore this safely and retain the
    // feed space above for a clean manual tear.
    Buffer.from([0x1d, 0x56, 0x42, 0x00])
  ]);
  const encodedScript = Buffer.from(windowsRawPrintScript, 'utf16le').toString('base64');

  try {
    await fsp.writeFile(printFilePath, printBytes, { mode: 0o600 });
    await execFileAsync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', encodedScript
    ], {
      env: {
        ...process.env,
        DIGIT_POS_PRINTER_NAME: deviceName,
        DIGIT_POS_PRINT_FILE: printFilePath
      },
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 1_000_000
    });
  } finally {
    await fsp.unlink(printFilePath).catch(() => {});
  }
};

const printHtmlSilently = async (webContents, options = {}) => {
  const html = String(options.html || '');
  const text = String(options.text || '');
  if (!html) throw new Error('Print content is required');
  if (Buffer.byteLength(html, 'utf8') > 2_000_000) throw new Error('Print content is too large');
  if (Buffer.byteLength(text, 'utf8') > 1_000_000) throw new Error('Text print content is too large');

  const deviceName = await resolveInstalledPrinter(webContents, options.printerName);
  const copies = Math.min(10, Math.max(1, Number(options.copies) || 1));
  if (process.platform === 'win32' && text) {
    try {
      for (let copy = 0; copy < copies; copy += 1) {
        await printRawTextOnWindows(deviceName, text);
      }
      return { printed: true, printerName: deviceName, printMode: 'WINDOWS_RAW' };
    } catch (error) {
      writeLog('warn', 'Windows RAW printing failed; falling back to Electron printing', {
        deviceName,
        error: error?.message || String(error)
      });
    }
  }

  const paperWidthMm = Math.min(210, Math.max(40, Number(options.paperWidthMm) || 58));
  const printWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  try {
    await printWindow.loadURL('about:blank');
    await printWindow.webContents.executeJavaScript(
      `document.open(); document.write(${JSON.stringify(html)}); document.close();`,
      true
    );
    const contentHeightPx = await printWindow.webContents.executeJavaScript(
      'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)',
      true
    );
    const paperHeightMicrons = Math.min(
      1_000_000,
      Math.max(50_000, Math.ceil(Number(contentHeightPx || 0) * 264.583) + 5_000)
    );

    const printPage = (printOptions) => new Promise((resolve, reject) => {
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (success) resolve();
        else reject(new Error(failureReason || `Unable to print to ${deviceName}`));
      });
    });

    try {
      await printPage({
        silent: true,
        printBackground: true,
        deviceName,
        copies,
        margins: { marginType: 'none' },
        pageSize: {
          width: Math.round(paperWidthMm * 1000),
          height: paperHeightMicrons
        }
      });
    } catch (error) {
      if (!String(error?.message || '').toLowerCase().includes('invalid printer settings')) throw error;

      writeLog('warn', 'Printer rejected custom thermal page size; retrying with driver defaults', {
        deviceName,
        paperWidthMm,
        paperHeightMicrons
      });
      await printPage({
        silent: true,
        printBackground: true,
        deviceName,
        copies,
        usePrinterDefaultPageSize: true
      });
    }
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }

  return { printed: true, printerName: deviceName };
};

ipcMain.handle('desktop:get-status', async () => ({
  apiBaseUrl,
  apiHealthUrl,
  backendStartedByDesktop,
  backendRunning: Boolean(backendProcess),
  lastBackendError,
  health: await checkApiHealth()
}));

ipcMain.handle('desktop:restart-backend', async () => {
  if (backendProcess) backendProcess.kill();
  backendProcess = null;
  lastBackendError = '';
  await startBackend();
  return waitForApi(15000);
});

ipcMain.handle('desktop:open-data-folder', async () => {
  await shell.openPath(app.getPath('userData'));
});

ipcMain.handle('desktop:open-app', async () => {
  const health = await checkApiHealth();
  if (!health.ok) return health;
  if (mainWindow) await loadApplication(mainWindow);
  return health;
});

ipcMain.handle('desktop:get-printers', async (event) => {
  assertDesktopRenderer(event);
  const printers = await installedPrintersFor(event.sender);
  return printers.map((printer) => printer.name).filter(Boolean);
});

ipcMain.handle('desktop:print-html', async (event, options) => {
  assertDesktopRenderer(event);
  return printHtmlSilently(event.sender, options);
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  app.setAppUserModelId('com.digitnp.restaurantpos');
  desktopConfig = await readDesktopConfig();
  initializeApiConfiguration(desktopConfig.apiBaseUrl);
  initializeLogging();
  mainWindow = createWindow();
  await startBackend();
  const health = await waitForApi(shouldUseLocalBackend ? 30000 : 5000);

  if (health.ok) await loadApplication(mainWindow);
  else await loadConnectionScreen(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      loadApplication(mainWindow).catch(() => loadConnectionScreen(mainWindow));
    }
  });
});

app.on('child-process-gone', (_event, details) => {
  writeLog('error', 'Electron child process exited', details);
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
