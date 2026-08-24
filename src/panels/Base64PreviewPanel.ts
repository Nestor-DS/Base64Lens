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
      <div class="logo">&#9670; Base64Lens</div>
      <div class="subtitle">decode // preview // export</div>
    </header>

    <div class="input-section">
      <div class="field">
        <label class="field-label">&gt; Base64 input</label>
        <div class="textarea-wrapper">
          <textarea id="base64Input" placeholder="Paste base64 string here..." rows="8" spellcheck="false"></textarea>
          <button id="copyBtn" class="copy-btn" title="Copy base64 to clipboard">copy</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="field toolbar-select">
          <label class="field-label">&gt; Type</label>
          <select id="fileType">
            <option value="unknown" selected>auto-detect</option>
            ${ALL_FILE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("\n            ")}
          </select>
        </div>

        <div class="toolbar-actions">
          <button id="openFileBtn" class="btn" title="Open file and convert to base64">[ open file ]</button>
          <button id="previewBtn" class="btn btn-accent" title="Preview (Ctrl+Enter)">[ decode ]</button>
          <button id="downloadBtn" class="btn" disabled title="Download decoded file">[ save ]</button>
          <button id="clearBtn" class="btn btn-dim" title="Clear all">[ clear ]</button>
        </div>
      </div>

      <div id="statusBar" class="status"></div>
    </div>

    <div id="previewSection" class="preview-section" style="display: none;">
      <div class="preview-bar">
        <span id="previewLabel" class="preview-label"></span>
        <span class="preview-badge" id="previewBadge"></span>
      </div>
      <div id="previewContainer" class="preview-container"></div>
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

              this._handleDownload(dataUri, fileType);
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

  private async _handleDownload(dataUri: string, fileType: FileType) {
    try {
      const parts = dataUri.split(",");
      if (parts.length < 2) {
        vscode.window.showErrorMessage("Invalid data URI for download.");
        return;
      }
      const base64Data = parts[1];

      const safeType = ALL_FILE_TYPES.includes(fileType) ? fileType : "bin";
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`preview.${safeType}`),
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
