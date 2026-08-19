import * as vscode from "vscode";

export function getUri(
  extensionPath: vscode.Uri,
  pathList: string[],
): vscode.Uri {
  return vscode.Uri.joinPath(extensionPath, ...pathList);
}
