import * as vscode from "vscode";
import { Base64LensView } from "./views/Base64LensView";

export function activate(context: vscode.ExtensionContext) {
  const provider = new Base64LensView(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      Base64LensView.viewId,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

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

      provider.openWith(selectedText);
    },
  );

  context.subscriptions.push(previewCommand);
}

export function deactivate() {}
