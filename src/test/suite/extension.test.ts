import * as assert from "node:assert";
import * as vscode from "vscode";

describe("Base64Lens extension", () => {
  function findSelf(): vscode.Extension<unknown> | undefined {
    return vscode.extensions.all.find(
      (e) => e.packageJSON?.name === "base64lens",
    );
  }

  it("is present and activates without errors", async () => {
    const extension = findSelf();
    assert.ok(extension, "Extension base64lens should be available");

    if (!extension.isActive) {
      await extension.activate();
    }
    assert.strictEqual(extension.isActive, true);
  });

  it("registers the preview command", async () => {
    const extension = findSelf();
    assert.ok(extension, "Extension base64lens should be available");
    if (!extension.isActive) {
      await extension.activate();
    }

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("base64lens.preview"),
      "Command base64lens.preview should be registered",
    );
  });
});
