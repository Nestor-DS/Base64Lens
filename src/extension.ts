import * as vscode from "vscode";
import { Base64PreviewPanel } from "./panels/Base64PreviewPanel";

export function activate(context: vscode.ExtensionContext) {
  const previewCommand = vscode.commands.registerCommand(
    "base64lens.preview",
    () => {
      const editor = vscode.window.activeTextEditor;
      let selectedText: string | undefined;

      if (editor) {
        const selection = editor.selection;
        if (!selection.isEmpty) {
          selectedText = editor.document.getText(selection).trim();
        }
      }

      Base64PreviewPanel.createOrShow(context.extensionUri, selectedText);
    },
  );

  context.subscriptions.push(previewCommand);
}

export function deactivate() {
  Base64PreviewPanel.currentPanel?.dispose();
}
