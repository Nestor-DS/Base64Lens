# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-20

### Added

- Initial release of Base64Lens.
- Preview Base64-encoded PDFs (page-by-page rendering via pdf.js).
- Preview Base64-encoded images: PNG, JPEG, GIF, WebP, BMP, ICO, TIFF, SVG.
- Automatic file-type detection based on magic bytes, with manual override.
- Load local files as Base64 (`[ open file ]`).
- Save decoded content back to disk (`[ save ]`).
- Copy Base64 to clipboard.
- Command Palette command, editor context-menu entry and `Ctrl+Alt+B` / `Cmd+Alt+B` keyboard shortcut.
