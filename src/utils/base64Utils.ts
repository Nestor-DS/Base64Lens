export type FileType =
  | "pdf"
  | "png"
  | "jpg"
  | "gif"
  | "svg"
  | "webp"
  | "bmp"
  | "ico"
  | "tiff"
  | "unknown";

export interface DetectionResult {
  type: FileType;
  mimeType: string;
  extension: string;
}

const MAGIC_BYTES: {
  type: FileType;
  mime: string;
  ext: string;
  bytes: number[];
}[] = [
  {
    type: "pdf",
    mime: "application/pdf",
    ext: "pdf",
    bytes: [0x25, 0x50, 0x44, 0x46],
  },
  {
    type: "png",
    mime: "image/png",
    ext: "png",
    bytes: [0x89, 0x50, 0x4e, 0x47],
  },
  { type: "jpg", mime: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  {
    type: "gif",
    mime: "image/gif",
    ext: "gif",
    bytes: [0x47, 0x49, 0x46, 0x38],
  },
  {
    type: "webp",
    mime: "image/webp",
    ext: "webp",
    bytes: [0x52, 0x49, 0x46, 0x46],
  },
  { type: "bmp", mime: "image/bmp", ext: "bmp", bytes: [0x42, 0x4d] },
  {
    type: "ico",
    mime: "image/x-icon",
    ext: "ico",
    bytes: [0x00, 0x00, 0x01, 0x00],
  },
  {
    type: "tiff",
    mime: "image/tiff",
    ext: "tiff",
    bytes: [0x49, 0x49, 0x2a, 0x00],
  },
  {
    type: "svg",
    mime: "image/svg+xml",
    ext: "svg",
    bytes: [0x3c, 0x73, 0x76, 0x67],
  },
];

const BASE64_REGEX = /^[A-Za-z0-9+/=\s]+$/;

export function cleanBase64(input: string): string {
  return input.replace(/[\s\r\n]/g, "");
}

export function isValidBase64(input: string): boolean {
  const cleaned = cleanBase64(input);
  if (cleaned.length === 0) {
    return false;
  }
  if (cleaned.length % 4 !== 0) {
    return false;
  }
  return BASE64_REGEX.test(cleaned);
}

export function getBase64Bytes(cleaned: string): Uint8Array {
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function detectFileType(base64: string): DetectionResult {
  const cleaned = cleanBase64(base64);

  if (cleaned.length < 8) {
    return {
      type: "unknown",
      mimeType: "application/octet-stream",
      extension: "bin",
    };
  }

  const bytes = getBase64Bytes(cleaned);

  for (const entry of MAGIC_BYTES) {
    let match = true;
    for (let i = 0; i < entry.bytes.length; i++) {
      if (bytes[i] !== entry.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { type: entry.type, mimeType: entry.mime, extension: entry.ext };
    }
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
    return { type: "svg", mimeType: "image/svg+xml", extension: "svg" };
  }

  return {
    type: "unknown",
    mimeType: "application/octet-stream",
    extension: "bin",
  };
}

export function getDataUri(base64: string, mimeType: string): string {
  const cleaned = cleanBase64(base64);
  return `data:${mimeType};base64,${cleaned}`;
}

export function getFileLabel(type: FileType): string {
  const labels: Record<FileType, string> = {
    pdf: "PDF Document",
    png: "PNG Image",
    jpg: "JPEG Image",
    gif: "GIF Image",
    svg: "SVG Image",
    webp: "WebP Image",
    bmp: "BMP Image",
    ico: "Icon",
    tiff: "TIFF Image",
    unknown: "Unknown",
  };
  return labels[type];
}

export function isImageType(type: FileType): boolean {
  return ["png", "jpg", "gif", "svg", "webp", "bmp", "ico", "tiff"].includes(
    type,
  );
}

export function isPdfType(type: FileType): boolean {
  return type === "pdf";
}

export const ALL_FILE_TYPES: FileType[] = [
  "pdf",
  "png",
  "jpg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "ico",
  "tiff",
];
