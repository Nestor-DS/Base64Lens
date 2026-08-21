declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
};

import * as pdfjsLib from "pdfjs-dist";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = "";

async function renderPdfToImages(
  base64: string,
  maxWidth: number = 1200,
  scale: number = 2,
): Promise<string[]> {
  const cleaned = base64.replace(/[\s\r\n]/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const loadingTask = (pdfjsLib as any).getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    let renderScale = scale;
    if (viewport.width > maxWidth) {
      renderScale = (scale * maxWidth) / viewport.width;
    }

    const scaledViewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({
      canvasContext: ctx,
      viewport: scaledViewport,
    }).promise;

    const dataUri = canvas.toDataURL("image/png");
    images.push(dataUri);
  }

  return images;
}

(window as any).renderPdfToImages = renderPdfToImages;
