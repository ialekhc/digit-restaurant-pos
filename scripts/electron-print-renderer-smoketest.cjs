const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  try {
    await printWindow.loadURL('about:blank');
    const html = '<!doctype html><html><body><section id="ticket">KOT renderer ready</section></body></html>';
    await printWindow.webContents.executeJavaScript(
      `document.open(); document.write(${JSON.stringify(html)}); document.close();`,
      true
    );
    const rendered = await printWindow.webContents.executeJavaScript(
      'document.querySelector("#ticket")?.textContent',
      true
    );
    if (rendered !== 'KOT renderer ready') throw new Error(`Unexpected rendered content: ${rendered}`);
    console.log('Electron print renderer smoke test passed');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
