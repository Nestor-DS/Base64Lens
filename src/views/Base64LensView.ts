import * as vscode from "vscode";
import {
  cleanBase64,
  isValidBase64,
  detectFileType,
  getDataUri,
  FileType,
  ALL_FILE_TYPES,
} from "../utils/base64Utils";
import type { WebviewToExtensionMessage } from "../shared/messages";
import { getWebviewHtml } from "./webviewHtml";

const DATA_URI_PATTERN =
  /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*$/;

export class Base64LensView implements vscode.WebviewViewProvider {
  public static readonly viewId = "base64lens.sidebar";
  public static readonly containerId = "workbench.view.extension.base64lens";

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _pendingBase64?: string;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "out")],
    };

    view.webview.html = getWebviewHtml(view.webview, this._extensionUri);
    this._setWebviewMessageListener(view.webview);

    view.onDidDispose(
      () => {
        this._view = undefined;
        while (this._disposables.length) {
          this._disposables.pop()?.dispose();
        }
      },
      null,
      this._disposables,
    );

    if (this._pendingBase64) {
      const data = this._pendingBase64;
      this._pendingBase64 = undefined;
      const timer = setTimeout(() => {
        void view.webview.postMessage({ command: "setBase64", data });
      }, 300);
      this._disposables.push(new DisposableTimer(timer));
    }
  }

  public openWith(initialBase64?: string) {
    if (!this._view) {
      if (initialBase64) {
        this._pendingBase64 = initialBase64;
      }
      void vscode.commands.executeCommand(Base64LensView.containerId);
      return;
    }

    if (initialBase64) {
      void this._view.webview.postMessage({
        command: "setBase64",
        data: initialBase64,
      });
    }
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
                const dataUri = getDataUri(cleaned, detected.mimeType);
                const sizeKB = Math.round((cleaned.length * 3) / 4 / 1024);
                void webview.postMessage({
                  command: "showPdfPreview",
                  dataUri,
                  fileType: "pdf",
                  mimeType: detected.mimeType,
                  label: `PDF  ${sizeKB} KB`,
                });
              } else {
                const dataUri = getDataUri(cleaned, detected.mimeType);
                const sizeKB = Math.round((cleaned.length * 3) / 4 / 1024);
                void webview.postMessage({
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

              void this._handleDownload(dataUri, fileType, message.suggestedName);
              break;
            }

            case "requestFile": {
              void this._handleOpenFile();
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
    void this._view?.webview.postMessage({ command, data });
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

      void this._view?.webview.postMessage({
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
          ? stripExtension(suggestedName.trim())
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

class DisposableTimer implements vscode.Disposable {
  constructor(private readonly _timer: ReturnType<typeof setTimeout>) {}

  dispose() {
    clearTimeout(this._timer);
  }
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
