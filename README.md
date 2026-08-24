# Base64Lens

<p align="center">
  <img src="media/icon.png" alt="Base64Lens logo" width="128" />
</p>

**Base64Lens** lets you visualize Base64-encoded PDFs, images, and documents directly inside VS Code — no more pasting long strings into online decoders. Everything is processed locally; no data ever leaves your machine.

## Features

- **PDF preview** — renders every page of a Base64-encoded PDF using [pdf.js](https://mozilla.github.io/pdf.js/)
- **Image preview** — PNG, JPEG, GIF, WebP, BMP, ICO, TIFF and SVG
- **Automatic file-type detection** via magic bytes, with manual override
- **File → Base64** — open any supported file and get its Base64 instantly
- **Decode → save** — export the decoded content back to a file
- **Copy to clipboard** with one click

## Usage

1. Select a Base64 string in the editor (or just have it in your clipboard).
2. Run the command in any of these ways:
   - **Command Palette**: `Base64Lens: Preview Base64`
   - **Context menu**: right-click the selection → _Preview Base64_
   - **Keyboard shortcut**: `Ctrl+Alt+B` (`Cmd+Alt+B` on macOS)
3. Paste or edit the string in the panel and press **[ decode ]** (or `Ctrl+Enter`).

You can also click **[ open file ]** to load a local file as Base64, and **[ save ]** to write the decoded bytes back to disk.

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
