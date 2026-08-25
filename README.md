# Base64Lens

<p align="center">
  <img src="media/icon.png" alt="Base64Lens logo" width="128" />
</p>

**Base64Lens** lets you visualize Base64-encoded PDFs, images, and documents directly inside VS Code — no more pasting long strings into online decoders. Everything is processed locally; no data ever leaves your machine.

## Features

- **Activity Bar view** — Base64Lens lives in the sidebar, always one click away
- **PDF preview** — renders every page of a Base64-encoded PDF using [pdf.js](https://mozilla.github.io/pdf.js/), with per-page progress
- **Image preview** — PNG, JPEG, GIF, WebP, BMP, ICO, TIFF and SVG
- **Automatic file-type detection** via magic bytes, with manual override
- **Drag & drop** — drop any supported file onto the panel to preview it
- **Live input stats** — character count, decoded size, validity and detected type as you type
- **Zoom controls** — zoom in / out, reset to 100% or fit to width
- **File → Base64** — open any supported file and get its Base64 instantly
- **Decode → save** — export the decoded content back to a file
- **Copy / paste to clipboard** with one click

## Usage

1. Select a Base64 string in the editor (or just have it in your clipboard).
2. Run the command in any of these ways:
   - **Command Palette**: `Base64Lens: Preview Base64`
   - **Context menu**: right-click the selection → _Preview Base64_
   - **Keyboard shortcut**: `Ctrl+Alt+B` (`Cmd+Alt+B` on macOS)
3. The selection loads and decodes automatically in the **Base64Lens side panel**.

You can also open the panel at any time from its icon in the **Activity Bar**, then paste a string, use the clipboard buttons, or simply **drop a file** onto the panel to preview it. Press **[ save ]** to write the decoded bytes back to disk (the original file name is suggested when available).

## Supported formats

| Type      | Formats                                   |
| --------- | ----------------------------------------- |
| Documents | PDF                                       |
| Images    | PNG, JPEG, GIF, WebP, BMP, ICO, TIFF, SVG |

## Security & privacy

- All decoding and rendering happens **locally** in your editor.
- The webview runs with a strict Content Security Policy and cryptographically random nonces.
- No telemetry, no network requests, no data collection.

## Requirements

- VS Code `1.85.0` or newer.

## Known limitations

- Very large files may take a few seconds to render.
- Encrypted/password-protected PDFs are not supported.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Nestor-DS
