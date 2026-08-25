import * as pdfjsLib from "pdfjs-dist";
import type { ExtensionToWebviewMessage } from "../src/shared/messages";
import type { FileType } from "../src/utils/base64Utils";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const workerSrc = document.body.getAttribute("data-worker-src");
if (workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

const base64Input = document.getElementById(
  "base64Input",
) as HTMLTextAreaElement;
const fileTypeSelect = document.getElementById("fileType") as HTMLSelectElement;
const previewBtn = document.getElementById("previewBtn") as HTMLButtonElement;
const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const openFileBtn = document.getElementById("openFileBtn") as HTMLButtonElement;
const emptyOpenBtn = document.getElementById("emptyOpenBtn") as HTMLButtonElement;
const pasteBtn = document.getElementById("pasteBtn") as HTMLButtonElement;
const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement;
const inputSection = document.getElementById("inputSection")!;
const inputStats = document.getElementById("inputStats")!;
const statusBar = document.getElementById("statusBar")!;
const emptyState = document.getElementById("emptyState")!;
const previewSection = document.getElementById("previewSection")!;
const previewLabel = document.getElementById("previewLabel")!;
const previewBadge = document.getElementById("previewBadge")!;
const previewContainer = document.getElementById("previewContainer")!;
const zoomControls = document.getElementById("zoomControls")!;
const zoomInBtn = document.getElementById("zoomIn") as HTMLButtonElement;
const zoomOutBtn = document.getElementById("zoomOut") as HTMLButtonElement;
const zoomResetBtn = document.getElementById(
  "zoomReset",
) as HTMLButtonElement;
const zoomFitBtn = document.getElementById("zoomFit") as HTMLButtonElement;
const toggleInputBtn = document.getElementById(
  "toggleInputBtn",
) as HTMLButtonElement;

let currentDataUri = "";
let currentFileType: FileType | "" = "";
let currentSuggestedName = "";

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

const STATUS_ICONS: Record<string, string> = {
  success: "\u2713",
  error: "\u2715",
  info: "\u203A",
};

function setStatus(text: string, type?: string) {
  statusBar.textContent = "";
  if (type && STATUS_ICONS[type]) {
    const icon = document.createElement("span");
    icon.className = "status-icon";
    icon.textContent = STATUS_ICONS[type];
    statusBar.appendChild(icon);
  }
  const label = document.createElement("span");
  label.textContent = text;
  statusBar.appendChild(label);
  statusBar.className = "status" + (type ? " " + type : "");
}

function showErrorBox(text: string) {
  previewContainer.innerHTML = "";
  const box = document.createElement("div");
  box.className = "error-box";
  const icon = document.createElement("span");
  icon.className = "error-icon";
  icon.textContent = "!";
  const msg = document.createElement("span");
  msg.className = "error-text";
  msg.textContent = text;
  box.appendChild(icon);
  box.appendChild(msg);
  previewContainer.appendChild(box);
}

/* ------------------------------------------------------------------ */
/* Loading overlay                                                     */
/* ------------------------------------------------------------------ */

let loadingOverlay: HTMLElement | null = null;

function showLoading(text: string) {
  hideLoading();
  loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";

  const spinner = document.createElement("div");
  spinner.className = "spinner";

  const label = document.createElement("div");
  label.className = "loading-text";
  label.textContent = text;

  loadingOverlay.appendChild(spinner);
  loadingOverlay.appendChild(label);
  previewContainer.appendChild(loadingOverlay);
}

function setLoadingText(text: string) {
  if (loadingOverlay) {
    const label = loadingOverlay.querySelector(".loading-text");
    if (label) label.textContent = text;
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.remove();
    loadingOverlay = null;
  }
}

/* ------------------------------------------------------------------ */
/* Input stats                                                         */
/* ------------------------------------------------------------------ */

const MAGIC_SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { type: "bmp", bytes: [0x42, 0x4d] },
  { type: "ico", bytes: [0x00, 0x00, 0x01, 0x00] },
  { type: "tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { type: "svg", bytes: [0x3c, 0x73, 0x76, 0x67] },
];

function cleanBase64(input: string): string {
  return input.replace(/[\s\r\n]/g, "");
}

function isValidBase64(input: string): boolean {
  const cleaned = cleanBase64(input);
  if (cleaned.length === 0 || cleaned.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(cleaned);
}

function detectTypeFromBase64(cleaned: string): string | null {
  if (cleaned.length < 8) return null;
  const usable = cleaned.slice(0, Math.floor(Math.min(cleaned.length, 64) / 4) * 4);
  try {
    const bin = atob(usable);
    for (const sig of MAGIC_SIGNATURES) {
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bin.charCodeAt(i) !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) return sig.type;
    }
  } catch {
    return null;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

let statsTimer: ReturnType<typeof setTimeout> | undefined;

function updateStats() {
  const cleaned = cleanBase64(base64Input.value);
  inputStats.textContent = "";
  inputStats.classList.remove("ok", "bad");

  if (cleaned.length === 0) return;

  const valid = isValidBase64(cleaned);
  const padding = cleaned.match(/=+$/)?.length ?? 0;
  const bytes = Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);

  const parts: string[] = [
    cleaned.length.toLocaleString() + " chars",
    "~" + formatBytes(bytes),
  ];
  if (valid) {
    const detected = detectTypeFromBase64(cleaned);
    if (detected) parts.push(detected.toUpperCase());
  } else {
    parts.push("invalid base64");
  }

  const mark = document.createElement("span");
  mark.className = "stats-mark";
  mark.textContent = valid ? "\u2713" : "\u2715";

  const text = document.createElement("span");
  text.textContent = parts.join(" \u00B7 ");

  inputStats.appendChild(mark);
  inputStats.appendChild(text);
  inputStats.classList.add(valid ? "ok" : "bad");
}

base64Input.addEventListener("input", () => {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(updateStats, 120);
});

/* ------------------------------------------------------------------ */
/* Zoom                                                                */
/* ------------------------------------------------------------------ */

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;
let zoomScale: number | null = null; // null = fit to width

function previewImages(): HTMLImageElement[] {
  return Array.from(previewContainer.querySelectorAll("img"));
}

function fitScale(): number {
  const first = previewImages()[0];
  if (!first || !first.naturalWidth) return 1;
  const avail = Math.max(previewContainer.clientWidth - 48, 100);
  return Math.min(avail / first.naturalWidth, 1);
}

function applyZoom() {
  const imgs = previewImages();
  if (!imgs.length) return;
  const scale = zoomScale === null ? fitScale() : zoomScale;
  for (const img of imgs) {
    if (!img.naturalWidth) continue;
    img.style.maxHeight = "none";
    img.style.height = "auto";
    img.style.width = Math.round(img.naturalWidth * scale) + "px";
  }
  zoomResetBtn.textContent = Math.round(scale * 100) + "%";
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

zoomInBtn.addEventListener("click", () => {
  zoomScale = clampZoom((zoomScale ?? fitScale()) + ZOOM_STEP);
  applyZoom();
});

zoomOutBtn.addEventListener("click", () => {
  zoomScale = clampZoom((zoomScale ?? fitScale()) - ZOOM_STEP);
  applyZoom();
});

zoomResetBtn.addEventListener("click", () => {
  zoomScale = 1;
  applyZoom();
});

zoomFitBtn.addEventListener("click", () => {
  zoomScale = null;
  applyZoom();
});

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (zoomScale === null) applyZoom();
  }, 100);
});

/* ------------------------------------------------------------------ */
/* Input panel toggle                                                  */
/* ------------------------------------------------------------------ */

interface PersistedState {
  inputCollapsed?: boolean;
}

function setInputCollapsed(collapsed: boolean) {
  document.body.classList.toggle("input-collapsed", collapsed);
  toggleInputBtn.classList.toggle("active", collapsed);
}

toggleInputBtn.addEventListener("click", () => {
  const collapsed = !document.body.classList.contains("input-collapsed");
  setInputCollapsed(collapsed);
  vscode.setState({ inputCollapsed: collapsed } satisfies PersistedState);
});

const savedState = vscode.getState() as PersistedState | undefined;
if (savedState?.inputCollapsed) {
  setInputCollapsed(true);
}

/* ------------------------------------------------------------------ */
/* Preview visibility helpers                                          */
/* ------------------------------------------------------------------ */

function showEmptyState() {
  previewSection.hidden = true;
  emptyState.hidden = false;
}

function showPreviewArea(label: string, mimeType: string) {
  emptyState.hidden = true;
  previewSection.hidden = false;
  previewLabel.textContent = label;
  previewBadge.textContent = mimeType;
  zoomControls.hidden = false;
  downloadBtn.disabled = false;
}

/* ------------------------------------------------------------------ */
/* PDF rendering                                                       */
/* ------------------------------------------------------------------ */

async function renderPdfToImages(
  dataUri: string,
  onPage?: (page: number, total: number) => void,
): Promise<string[]> {
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;
  const cleaned = base64.replace(/[\s\r\n]/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const images: string[] = [];
  const maxWidth = 1200;
  const baseScale = 2;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onPage?.(pageNum, pdf.numPages);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: baseScale });
    let renderScale = baseScale;
    if (viewport.width > maxWidth) {
      renderScale = (baseScale * maxWidth) / viewport.width;
    }
    const scaledViewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(scaledViewport.width);
    canvas.height = Math.floor(scaledViewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function doPreview() {
  const base64 = base64Input.value.trim();
  if (!base64) {
    setStatus("no content. paste a string or open a file.", "error");
    return;
  }
  setStatus("decoding\u2026", "info");
  vscode.postMessage({
    command: "preview",
    base64,
    fileType: fileTypeSelect.value,
  });
}

previewBtn.addEventListener("click", doPreview);

openFileBtn.addEventListener("click", () => {
  vscode.postMessage({ command: "requestFile" });
});
emptyOpenBtn.addEventListener("click", () => {
  vscode.postMessage({ command: "requestFile" });
});

function flashButton(btn: HTMLButtonElement, text: string, doneText: string) {
  btn.textContent = doneText;
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = text;
    btn.classList.remove("copied");
  }, 1500);
}

copyBtn.addEventListener("click", () => {
  const text = base64Input.value.trim();
  if (!text) {
    setStatus("nothing to copy.", "error");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      flashButton(copyBtn, "copy", "copied!");
      setStatus("base64 copied to clipboard.", "success");
    },
    () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        flashButton(copyBtn, "copy", "copied!");
        setStatus("base64 copied to clipboard.", "success");
      } catch {
        setStatus("failed to copy. select the text manually.", "error");
      }
      document.body.removeChild(ta);
    },
  );
});

pasteBtn.addEventListener("click", () => {
  navigator.clipboard.readText().then(
    (text) => {
      if (!text) {
        setStatus("clipboard is empty.", "error");
        return;
      }
      base64Input.value = text.trim();
      updateStats();
      setStatus("pasted from clipboard.", "success");
    },
    () => {
      setStatus("clipboard access denied by the system.", "error");
    },
  );
});

downloadBtn.addEventListener("click", () => {
  if (currentDataUri) {
    vscode.postMessage({
      command: "download",
      dataUri: currentDataUri,
      fileType: currentFileType,
      suggestedName: currentSuggestedName || undefined,
    });
  }
});

clearBtn.addEventListener("click", () => {
  base64Input.value = "";
  fileTypeSelect.value = "unknown";
  previewContainer.innerHTML = "";
  previewContainer.classList.remove("pdf-pages");
  previewContainer.scrollTop = 0;
  currentDataUri = "";
  currentFileType = "";
  currentSuggestedName = "";
  zoomScale = null;
  zoomResetBtn.textContent = "100%";
  downloadBtn.disabled = true;
  inputStats.textContent = "";
  inputStats.classList.remove("ok", "bad");
  showEmptyState();
  setStatus("", undefined);
});

base64Input.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    doPreview();
  }
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    doPreview();
  }
});

/* ------------------------------------------------------------------ */
/* Drag & drop                                                         */
/* ------------------------------------------------------------------ */

const MAX_DROP_BYTES = 100 * 1024 * 1024;
let dragDepth = 0;

function eventHasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

window.addEventListener("dragenter", (e: DragEvent) => {
  e.preventDefault();
  if (!eventHasFiles(e)) return;
  dragDepth++;
  document.body.classList.add("drag-over");
});

window.addEventListener("dragover", (e: DragEvent) => {
  e.preventDefault();
});

window.addEventListener("dragleave", (e: DragEvent) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove("drag-over");
});

window.addEventListener("drop", (e: DragEvent) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove("drag-over");

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  if (file.size > MAX_DROP_BYTES) {
    setStatus(`"${file.name}" is too large (max 100 MB).`, "error");
    return;
  }

  setStatus(`reading "${file.name}"\u2026`, "info");
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result ?? "");
    base64Input.value = result.includes(",") ? result.split(",")[1] : result;
    fileTypeSelect.value = "unknown";
    currentSuggestedName = file.name;
    updateStats();
    doPreview();
  };
  reader.onerror = () => {
    setStatus(`failed to read "${file.name}".`, "error");
  };
  reader.readAsDataURL(file);
});

/* ------------------------------------------------------------------ */
/* Extension -> webview messages                                       */
/* ------------------------------------------------------------------ */

window.addEventListener(
  "message",
  (event: MessageEvent<ExtensionToWebviewMessage>) => {
    const message = event.data;

    switch (message.command) {
      case "setBase64":
        base64Input.value = message.data;
        updateStats();
        setStatus(
          message.data.length.toLocaleString() +
            " chars loaded from selection.",
          "success",
        );
        doPreview();
        break;

      case "fileLoaded":
        base64Input.value = message.base64;
        fileTypeSelect.value = "unknown";
        currentSuggestedName = message.fileName;
        updateStats();
        doPreview();
        break;

      case "showPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        showPreviewArea(message.label, message.mimeType);
        previewContainer.innerHTML = "";
        previewContainer.classList.remove("pdf-pages");
        previewContainer.scrollTop = 0;

        const img = document.createElement("img");
        img.src = message.dataUri;
        img.alt = message.label;
        img.onload = () => applyZoom();
        img.onerror = () => {
          showErrorBox(
            "Failed to render image. The Base64 data may be corrupted or the format is unsupported.",
          );
          setStatus("render failed. data may be corrupted.", "error");
        };
        previewContainer.appendChild(img);
        setStatus("preview ready.", "success");
        break;
      }

      case "showPdfPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        showPreviewArea(message.label, message.mimeType);
        previewContainer.innerHTML = "";
        previewContainer.classList.add("pdf-pages");
        previewContainer.scrollTop = 0;

        setStatus("rendering pdf\u2026", "info");
        showLoading("rendering pdf\u2026");

        renderPdfToImages(message.dataUri, (page, total) =>
          setLoadingText(`rendering page ${page} / ${total}\u2026`),
        )
          .then((images) => {
            hideLoading();
            previewContainer.innerHTML = "";
            if (images.length === 0) {
              showErrorBox("PDF has no renderable pages.");
              setStatus("pdf has no pages.", "error");
              return;
            }
            images.forEach((src, i) => {
              const img = document.createElement("img");
              img.src = src;
              img.alt = "Page " + (i + 1);
              img.onload = () => applyZoom();
              previewContainer.appendChild(img);
            });
            setStatus(
              `pdf ready \u00B7 ${images.length} page${images.length > 1 ? "s" : ""}.`,
              "success",
            );
          })
          .catch((err: unknown) => {
            hideLoading();
            showErrorBox("Failed to render PDF: " + String(err));
            setStatus("pdf render failed.", "error");
          });
        break;
      }

      case "showError": {
        setStatus(message.data, "error");
        if (
          previewSection.hidden ||
          previewContainer.childElementCount === 0 ||
          loadingOverlay !== null
        ) {
          hideLoading();
          showEmptyState();
        }
        break;
      }
    }
  },
);
