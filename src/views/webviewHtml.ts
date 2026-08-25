import * as vscode from "vscode";
import * as crypto from "crypto";
import { ALL_FILE_TYPES } from "../utils/base64Utils";

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = getNonce();

  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "webview", "styles.css"),
  );
  const mainScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "webview.js"),
  );
  const workerUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "pdf.worker.min.mjs"),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource}; img-src data: ${webview.cspSource}; worker-src ${webview.cspSource};">
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
      <p class="empty-hint">Paste a Base64 string above, drop a file here, or open one from disk.</p>
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
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7.25 2.75h1.5v4.5h4.5v1.5h-4.5v4.5h-1.5v-4.5h-4.5v-1.5h4.5z"/></svg>
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

function getNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}
