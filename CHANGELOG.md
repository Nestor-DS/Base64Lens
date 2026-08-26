# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-08-25

### Added

- Activity Bar icon: Base64Lens now lives in the sidebar as a native view (state persists across sessions).
- Real-time input statistics: character count, estimated decoded size, validity check, and detected type while typing.
- Zoom controls for previews: zoom in / out, 100%, and fit-to-width.
- Loading indicator with per-page progress when rendering PDF files.
- Paste-from-clipboard button.
- Empty state with quick actions and keyboard suggestions.
- Save dialog now suggests the original filename when available.
- New design.

### Changed

- Previews decode automatically after loading a selection or a file (no extra click required).
- Improved visual design: focus rings, hover states, reduced-motion support, and better accessibility (ARIA labels, live regions).

### Fixed

- Test runner configuration (`mocha` UI set to `bdd`, test output paths) — full test suite runs again.
- UI style loading.

## [0.1.0] - 2026-08-20

### Added

- Initial release of Base64Lens.
- Preview Base64-encoded PDFs (page-by-page rendering via pdf.js).
- Preview Base64-encoded images: PNG, JPEG, GIF, WebP, BMP, ICO, TIFF, SVG.
- Automatic file-type detection based on magic bytes, with manual override.
- Load local files as Base64.
- Save decoded content back to disk.
- Copy Base64 to clipboard.
