import type { FileType } from "../utils/base64Utils";

export interface SetBase64Message {
  command: "setBase64";
  data: string;
}

export interface FileLoadedMessage {
  command: "fileLoaded";
  base64: string;
  fileName: string;
}

export interface ShowPreviewMessage {
  command: "showPreview";
  dataUri: string;
  fileType: FileType;
  mimeType: string;
  label: string;
}

export interface ShowPdfPreviewMessage {
  command: "showPdfPreview";
  pdfUri?: string;
  dataUri: string;
  fileType: FileType;
  mimeType: string;
  label: string;
}

export interface ShowErrorMessage {
  command: "showError";
  data: string;
}

export type ExtensionToWebviewMessage =
  | SetBase64Message
  | FileLoadedMessage
  | ShowPreviewMessage
  | ShowPdfPreviewMessage
  | ShowErrorMessage;

export interface PreviewRequestMessage {
  command: "preview";
  base64: string;
  fileType: string;
}

export interface DownloadRequestMessage {
  command: "download";
  dataUri: string;
  fileType: FileType;
  suggestedName?: string;
}

export interface RequestFileMessage {
  command: "requestFile";
}

export type WebviewToExtensionMessage =
  | PreviewRequestMessage
  | DownloadRequestMessage
  | RequestFileMessage;
