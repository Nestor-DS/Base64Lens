import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as fs from "fs";
import {
  cleanBase64,
  isValidBase64,
  detectFileType,
  getDataUri,
  FileType,
  ALL_FILE_TYPES,
} from "../utils/base64Utils";
import type { WebviewToExtensionMessage } from "../shared/messages";

const DATA_URI_PATTERN =
  /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*$/;

export class Base64PreviewPanel {
  public static currentPanel: Base64PreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _tempDir: string;

  public static createOrShow(extensionUri: vscode.Uri, initialBase64?: string) {
    if (Base64PreviewPanel.currentPanel) {
      Base64PreviewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      if (initialBase64) {
        Base64PreviewPanel.currentPanel._panel.webview.postMessage({
          command: "setBase64",
          data: initialBase64,
        });
      }
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "base64lens-"));

    const panel = vscode.window.createWebviewPanel(
      "base64lens",
      "Base64Lens",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "out"),
          vscode.Uri.joinPath(extensionUri, "webview"),
          vscode.Uri.file(tempDir),
        ],
      },
    );

    Base64PreviewPanel.currentPanel = new Base64PreviewPanel(
      panel,
      extensionUri,
      tempDir,
      initialBase64,
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    tempDir: string,
    initialBase64?: string,
  ) {
    this._panel = panel;
    this._tempDir = tempDir;
    this._panel.webview.html = this._getWebviewContent();
    this._setWebviewMessageListener(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    if (initialBase64) {
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: "setBase64",
          data: initialBase64,
        });
      }, 300);
    }
  }

  public dispose() {
    this._cleanTempDir();
    Base64PreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _cleanTempDir() {
    try {
      if (fs.existsSync(this._tempDir)) {
        const files = fs.readdirSync(this._tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this._tempDir, file));
        }
        fs.rmdirSync(this._tempDir);
      }
    } catch {}
  }

  private _getWebviewContent(): string {
    const nonce = getNonce();

    const stylesUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "styles.css"),
    );
    const mainScriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "webview.js"),
    );
    const workerUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "pdf.worker.min.mjs"),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}' ${this._panel.webview.cspSource}; img-src data: ${this._panel.webview.cspSource}; worker-src ${this._panel.webview.cspSource};">
  <title>Base64Lens</title>
  <link rel="stylesheet" href="${stylesUri}">
</head>
<body data-worker-src="${workerUri}">
  <div class="app">
    <header class="header">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Base64Lens
      </div>
      <div class="subtitle">decode &middot; preview &middot; export</div>
    </header>

    <section id="inputSection" class="input-section" aria-label="Base64 input">
      <div class="field">
        <div class="field-header">
          <label class="field-label" for="base64Input">base64 input</label>
          <span id="inputStats" class="input-stats" aria-live="polite"></span>
        </div>
        <div class="textarea-wrapper">
          <textarea id="base64Input" placeholder="Paste a Base64 string here, or drop a file anywhere in this panel&hellip;" rows="6" spellcheck="false" aria-label="Base64 string"></textarea>
          <div class="textarea-actions">
            <button id="pasteBtn" class="mini-btn" title="Paste from clipboard" aria-label="Paste from clipboard">paste</button>
            <button id="copyBtn" class="mini-btn" title="Copy to clipboard" aria-label="Copy to clipboard">copy</button>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-select">
          <label class="field-label" for="fileType">type</label>
          <select id="fileType" aria-label="File type override">
            <option value="unknown" selected>auto-detect</option>
            ${ALL_FILE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("\n            ")}
          </select>
        </div>

        <div class="toolbar-actions">
          <button id="openFileBtn" class="btn btn-secondary" title="Open a local file and convert it to Base64">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.086a1.5 1.5 0 0 1 1.06.44l.915.914a.5.5 0 0 0 .353.146H13A1.5 1.5 0 0 1 14.5 4.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3Z"/></svg>
            open file
          </button>
          <button id="previewBtn" class="btn btn-accent" title="Decode and preview (Ctrl+Enter)">
            decode
            <kbd>Ctrl&#8629;</kbd>
          </button>
          <button id="downloadBtn" class="btn btn-secondary" disabled title="Save decoded content to disk">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8 1.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V2.25A.75.75 0 0 1 8 1.5ZM2.25 12.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H2.25Z"/></svg>
            save
          </button>
          <button id="clearBtn" class="btn btn-text" title="Clear everything">clear</button>
        </div>
      </div>
    </section>

    <div id="statusBar" class="status" role="status" aria-live="polite"></div>

    <section id="emptyState" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/>
        <line x1="30" y1="30" x2="41" y2="41" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <text x="20" y="24.5" text-anchor="middle" font-size="10" font-family="monospace" fill="currentColor" opacity="0.85">64</text>
      </svg>
      <p class="empty-title">Nothing to preview yet</p>
      <p class="empty-hint">Paste a Base64 string above, drop a file here,<br>or open one from disk.</p>
      <button id="emptyOpenBtn" class="btn btn-secondary">open file</button>
      <p class="empty-kbd"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>to decode</span></p>
    </section>

    <section id="previewSection" class="preview-section" hidden aria-label="Preview">
      <div class="preview-bar">
        <div class="preview-info">
          <span id="previewLabel" class="preview-label"></span>
          <span id="previewBadge" class="preview-badge"></span>
        </div>
        <div class="preview-tools">
          <div id="zoomControls" class="zoom-controls" role="group" aria-label="Zoom controls" hidden>
            <button id="zoomOut" class="tool-btn" title="Zoom out" aria-label="Zoom out">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M2.75 7.25h10.5v1.5H2.75z"/></svg>
            </button>
            <button id="zoomReset" class="tool-btn zoom-label" title="Reset to 100%">100%</button>
            <button id="zoomIn" class="tool-btn" title="Zoom in" aria-label="Zoom in">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7.25 2.75h1.5v4.5h4.5v1.5h-4.5v4.5h-1.5v-4.5h-4.5v-1.5h4.5v-4.5Z"/></svg>
            </button>
            <button id="zoomFit" class="tool-btn" title="Fit to width" aria-label="Fit to width">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M1.5 3.5h13v1.2h-13zM1.5 11.3h13v1.2h-13zM4.2 6.6l-2.4 1.4 2.4 1.4v-2.8zm7.6 0v2.8l2.4-1.4-2.4-1.4z"/></svg>
            </button>
          </div>
          <span class="tool-sep"></span>
          <button id="toggleInputBtn" class="tool-btn" title="Show / hide input panel" aria-label="Toggle input panel">
            <svg id="toggleChevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7.97 4.72 3.7 9l1.06 1.06 3.19-3.19 3.19 3.19L12.2 9 7.97 4.72z" transform="rotate(180 8 8)"/></svg>
          </button>
        </div>
      </div>
      <div id="previewContainer" class="preview-container"></div>
    </section>

    <div id="dropOverlay" class="drop-overlay" aria-hidden="true">
      <div class="drop-box">
        <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M24 30V10m0 20-8-8m8 8 8-8M8 34v4a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-4"/>
        </svg>
        <span>Drop file to load as Base64</span>
      </div>
    </div>
  </div>

  <script type="module" nonce="${nonce}" src="${mainScriptUri}"></script>
</body>
</html>`;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        try {
          switch (message.command) {
            case "preview": {
              const base64 = message.base64;
              const selectedType = message.fileType as FileType;

              if (!base64 || base64.trim().length === 0) {
                this._sendMessage(
                  "showError",
                  "No base64 content provided. Paste a string or open a file.",
                );
                return;
              }

              if (!isValidBase64(base64)) {
                this._sendMessage(
                  "showError",
                  "Invalid base64 string. Check content: only A-Z, a-z, 0-9, +, /, = allowed. Length must be multiple of 4.",
                );
                return;
              }

              const cleaned = cleanBase64(base64);
              const detected = detectFileType(cleaned);
              const finalType =
                selectedType !== "unknown" ? selectedType : detected.type;

              if (finalType === "unknown") {
                this._sendMessage(
                  "showError",
                  "Could not detect file type. Select a type manually from the dropdown.",
                );
                return;
              }

              if (finalType === "pdf") {
                this._handlePdfPreview(cleaned, detected.mimeType);
              } else {
                const dataUri = getDataUri(cleaned, detected.mimeType);
                const sizeKB = Math.round((cleaned.length * 3) / 4 / 1024);
                this._panel.webview.postMessage({
                  command: "showPreview",
                  dataUri,
                  fileType: finalType,
                  mimeType: detected.mimeType,
                  label: `${finalType.toUpperCase()}  ${sizeKB} KB`,
                });
              }
              break;
            }

            case "download": {
              const dataUri = message.dataUri;
              const fileType = message.fileType;

              if (!DATA_URI_PATTERN.test(dataUri)) {
                this._sendMessage("showError", "Invalid data URI for download.");
                return;
              }
              if (!ALL_FILE_TYPES.includes(fileType)) {
                this._sendMessage(
                  "showError",
                  `Unsupported file type for download: ${String(fileType)}`,
                );
                return;
              }

              this._handleDownload(dataUri, fileType, message.suggestedName);
              break;
            }

            case "requestFile": {
              this._handleOpenFile();
              break;
            }
          }
        } catch (err) {
          this._sendMessage(
            "showError",
            `Unexpected error: ${toErrorMessage(err)}`,
          );
        }
      },
      undefined,
      this._disposables,
    );
  }

  private _sendMessage(command: string, data: string) {
    this._panel.webview.postMessage({ command, data });
  }

  private _handlePdfPreview(cleanedBase64: string, mimeType: string) {
    try {
      const buffer = Buffer.from(cleanedBase64, "base64");
      const filePath = path.join(this._tempDir, `preview_${Date.now()}.pdf`);
      fs.writeFileSync(filePath, buffer);

      const fileUri = vscode.Uri.file(filePath);
      const webviewUri = this._panel.webview.asWebviewUri(fileUri);
      const dataUri = getDataUri(cleanedBase64, mimeType);
      const sizeKB = Math.round(buffer.length / 1024);

      this._panel.webview.postMessage({
        command: "showPdfPreview",
        pdfUri: webviewUri.toString(),
        dataUri,
        fileType: "pdf",
        mimeType,
        label: `PDF  ${sizeKB} KB`,
      });
    } catch (err) {
      this._sendMessage("showError", `Failed to render PDF: ${toErrorMessage(err)}`);
    }
  }

  private _stripExtension(name: string): string {
    const idx = name.lastIndexOf(".");
    return idx > 0 ? name.slice(0, idx) : name;
  }

  private async _handleOpenFile() {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: "Load as Base64",
      filters: {
        "All supported": [
          "pdf",
          "png",
          "jpg",
          "jpeg",
          "gif",
          "svg",
          "webp",
          "bmp",
          "ico",
          "tiff",
          "txt",
        ],
        Images: [
          "png",
          "jpg",
          "jpeg",
          "gif",
          "svg",
          "webp",
          "bmp",
          "ico",
          "tiff",
        ],
        PDF: ["pdf"],
        Text: ["txt", "json", "xml", "csv"],
      },
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const uri = uris[0];
    try {
      const fileData = await vscode.workspace.fs.readFile(uri);
      const base64 = Buffer.from(fileData).toString("base64");
      const fileName = uri.path.split("/").pop() || "file";

      this._panel.webview.postMessage({
        command: "fileLoaded",
        base64,
        fileName,
      });
    } catch (err) {
      this._sendMessage("showError", `Failed to read file: ${toErrorMessage(err)}`);
    }
  }

  private async _handleDownload(
    dataUri: string,
    fileType: FileType,
    suggestedName?: string,
  ) {
    try {
      const parts = dataUri.split(",");
      if (parts.length < 2) {
        vscode.window.showErrorMessage("Invalid data URI for download.");
        return;
      }
      const base64Data = parts[1];

      const safeType = ALL_FILE_TYPES.includes(fileType) ? fileType : "bin";
      const baseName =
        suggestedName && suggestedName.trim().length > 0
          ? this._stripExtension(suggestedName.trim())
          : "preview";
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${baseName}.${safeType}`),
        filters: { "All Files": ["*"] },
      });

      if (uri) {
        const buffer = Buffer.from(base64Data, "base64");
        await vscode.workspace.fs.writeFile(uri, buffer);
        vscode.window.showInformationMessage(`Saved: ${uri.fsPath}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Download failed: ${toErrorMessage(err)}`);
    }
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function getNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}
