# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Activity Bar icon: Base64Lens now lives in the sidebar as a native view (state persists across sessions).
- Drag & drop files onto the panel to load them as Base64.
- Live input stats: character count, estimated decoded size, validity check and detected type while typing.
- Zoom controls for previews: zoom in / out, 100% and fit-to-width.
- Loading spinner with per-page progress while rendering PDFs.
- Paste-from-clipboard button.
- Empty state with quick actions and keyboard hints.
- Collapsible input panel to give more room to the preview (remembered between sessions).
- Save dialog now suggests the original file name when available.

### Changed

- Previews decode automatically after loading a selection or a file (no extra click needed).
- Polished visual design: focus rings, hover states, reduced-motion support and improved accessibility (ARIA labels, live regions).
- Global `Ctrl+Enter` shortcut works anywhere in the panel.

### Fixed

- Test runner configuration (`mocha` UI set to `bdd`, test output paths) — the full suite runs again.

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
