import * as pdfjsLib from "pdfjs-dist";
import type { ExtensionToWebviewMessage } from "../src/shared/messages";

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
const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement;
const statusBar = document.getElementById("statusBar")!;
const previewSection = document.getElementById("previewSection")!;
const previewLabel = document.getElementById("previewLabel")!;
const previewBadge = document.getElementById("previewBadge")!;
const previewContainer = document.getElementById("previewContainer")!;

let currentDataUri = "";
let currentFileType = "";

function setStatus(text: string, type?: string) {
  statusBar.textContent = text;
  statusBar.className = "status" + (type ? " " + type : "");
}

function showErrorBox(text: string) {
  previewContainer.innerHTML =
    '<div class="error-box">' +
    '<span class="error-icon">!</span>' +
    '<span class="error-text">' +
    text +
    "</span>" +
    "</div>";
}

async function renderPdfToImages(dataUri: string): Promise<string[]> {
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

function doPreview() {
  const base64 = base64Input.value.trim();
  if (!base64) {
    setStatus("! no base64 content. paste a string or open a file.", "error");
    return;
  }
  setStatus("decoding...", "info");
  previewBtn.disabled = true;
  setTimeout(() => {
    previewBtn.disabled = false;
  }, 300);
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

copyBtn.addEventListener("click", () => {
  const text = base64Input.value.trim();
  if (!text) {
    setStatus("! nothing to copy.", "error");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      copyBtn.textContent = "copied!";
      copyBtn.classList.add("copied");
      setStatus("base64 copied to clipboard.", "success");
      setTimeout(() => {
        copyBtn.textContent = "copy";
        copyBtn.classList.remove("copied");
      }, 1500);
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
        copyBtn.textContent = "copied!";
        copyBtn.classList.add("copied");
        setStatus("base64 copied to clipboard.", "success");
        setTimeout(() => {
          copyBtn.textContent = "copy";
          copyBtn.classList.remove("copied");
        }, 1500);
      } catch {
        setStatus(
          "! failed to copy. try manually selecting the text.",
          "error",
        );
      }
      document.body.removeChild(ta);
    },
  );
});

downloadBtn.addEventListener("click", () => {
  if (currentDataUri) {
    vscode.postMessage({
      command: "download",
      dataUri: currentDataUri,
      fileType: currentFileType,
    });
  }
});

clearBtn.addEventListener("click", () => {
  base64Input.value = "";
  fileTypeSelect.value = "unknown";
  previewSection.style.display = "none";
  previewContainer.innerHTML = "";
  previewContainer.classList.remove("pdf-pages");
  currentDataUri = "";
  currentFileType = "";
  downloadBtn.disabled = true;
  statusBar.textContent = "";
  statusBar.className = "status";
  copyBtn.textContent = "copy";
  copyBtn.classList.remove("copied");
});

base64Input.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    doPreview();
  }
});

window.addEventListener(
  "message",
  (event: MessageEvent<ExtensionToWebviewMessage>) => {
    const message = event.data;

    switch (message.command) {
      case "setBase64":
        base64Input.value = message.data;
        setStatus(
          "loaded " +
            message.data.length +
            " chars. press [ decode ] or Ctrl+Enter.",
          "success",
        );
        break;

      case "fileLoaded":
        base64Input.value = message.base64;
        fileTypeSelect.value = "unknown";
        setStatus(
          'file "' +
            message.fileName +
            '" loaded (' +
            message.base64.length +
            " chars). decoding...",
          "success",
        );
        break;

      case "showPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        previewLabel.textContent = message.label;
        previewBadge.textContent = message.mimeType;
        previewContainer.innerHTML = "";
        previewContainer.classList.remove("pdf-pages");

        try {
          const img = document.createElement("img");
          img.src = message.dataUri;
          img.alt = message.label;
          img.onerror = () => {
            showErrorBox(
              "failed to render image. the base64 data may be corrupted or the format is unsupported.",
            );
            setStatus("! render failed. data may be corrupted.", "error");
          };
          previewContainer.appendChild(img);
          previewSection.style.display = "flex";
          previewSection.style.flexDirection = "column";
          downloadBtn.disabled = false;
          setStatus("preview ready.", "success");
        } catch (err) {
          showErrorBox("render error: " + String(err));
          setStatus("! render error: " + String(err), "error");
        }
        break;
      }

      case "showPdfPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        previewLabel.textContent = message.label;
        previewBadge.textContent = message.mimeType;
        previewContainer.innerHTML = "";
        previewContainer.classList.add("pdf-pages");

        setStatus("rendering pdf...", "info");

        renderPdfToImages(message.dataUri)
          .then((images) => {
            previewContainer.innerHTML = "";
            if (images.length === 0) {
              showErrorBox("pdf has no renderable pages.");
              setStatus("! pdf has no pages.", "error");
              return;
            }
            for (let i = 0; i < images.length; i++) {
              const img = document.createElement("img");
              img.src = images[i];
              img.alt = "Page " + (i + 1);
              img.style.width = "100%";
              previewContainer.appendChild(img);
              if (i < images.length - 1) {
                const sep = document.createElement("div");
                sep.style.height = "1px";
                sep.style.background = "var(--border)";
                sep.style.margin = "8px 0";
                previewContainer.appendChild(sep);
              }
            }
            previewSection.style.display = "flex";
            previewSection.style.flexDirection = "column";
            downloadBtn.disabled = false;
            setStatus(
              "pdf rendered (" +
                images.length +
                " page" +
                (images.length > 1 ? "s" : "") +
                ").",
              "success",
            );
          })
          .catch((err: unknown) => {
            showErrorBox("failed to render pdf: " + String(err));
            setStatus("! pdf render failed: " + String(err), "error");
          });
        break;
      }

      case "showError":
        setStatus("! " + message.data, "error");
        previewSection.style.display = "none";
        downloadBtn.disabled = true;
        break;
    }
  },
);
