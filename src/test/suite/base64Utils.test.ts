import * as assert from "node:assert";
import {
  cleanBase64,
  isValidBase64,
  detectFileType,
  getDataUri,
} from "../../utils/base64Utils";

function toBase64(input: string | Uint8Array): string {
  return Buffer.from(input).toString("base64");
}

describe("cleanBase64", () => {
  it("removes whitespace, tabs and newlines", () => {
    assert.strictEqual(cleanBase64("aG9s\nYQ==\t"), "aG9sYQ==");
    assert.strictEqual(cleanBase64(" a b c d "), "abcd");
    assert.strictEqual(cleanBase64("a\r\nb"), "ab");
  });
});

describe("isValidBase64", () => {
  it("accepts valid base64", () => {
    assert.strictEqual(isValidBase64("aGVsbG8="), true);
    assert.strictEqual(isValidBase64("aGVsb G8=\n"), true);
    assert.strictEqual(isValidBase64(toBase64("%PDF-1.7 test")), true);
  });

  it("rejects strings with invalid characters", () => {
    assert.strictEqual(isValidBase64("aGVsbG8*!"), false);
    assert.strictEqual(isValidBase64("<script>alert(1)</script>"), false);
  });

  it("rejects strings whose length is not a multiple of 4", () => {
    assert.strictEqual(isValidBase64("abc"), false);
    assert.strictEqual(isValidBase64("abcde"), false);
  });

  it("rejects empty input", () => {
    assert.strictEqual(isValidBase64(""), false);
    assert.strictEqual(isValidBase64("   \n\t "), false);
  });
});

describe("detectFileType", () => {
  it("detects PDF by magic bytes", () => {
    const result = detectFileType(toBase64("%PDF-1.7\n..."));
    assert.strictEqual(result.type, "pdf");
    assert.strictEqual(result.mimeType, "application/pdf");
    assert.strictEqual(result.extension, "pdf");
  });

  it("detects PNG by magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = detectFileType(toBase64(png));
    assert.strictEqual(result.type, "png");
    assert.strictEqual(result.mimeType, "image/png");
  });

  it("detects JPEG by magic bytes", () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const result = detectFileType(toBase64(jpg));
    assert.strictEqual(result.type, "jpg");
    assert.strictEqual(result.mimeType, "image/jpeg");
  });

  it("detects GIF by magic bytes", () => {
    const result = detectFileType(toBase64("GIF89a...."));
    assert.strictEqual(result.type, "gif");
    assert.strictEqual(result.mimeType, "image/gif");
  });

  it("falls back to svg for text-like content without magic bytes", () => {
    const result = detectFileType(toBase64("hello world this is text"));
    assert.strictEqual(result.type, "svg");
    assert.strictEqual(result.mimeType, "image/svg+xml");
  });

  it("returns unknown for very short input", () => {
    const result = detectFileType(toBase64("ab"));
    assert.strictEqual(result.type, "unknown");
    assert.strictEqual(result.mimeType, "application/octet-stream");
  });
});

describe("getDataUri", () => {
  it("builds a well-formed data URI", () => {
    const base64 = toBase64("%PDF-1.4");
    const uri = getDataUri(base64, "application/pdf");
    assert.ok(uri.startsWith("data:application/pdf;base64,"));
    assert.ok(uri.endsWith(base64));
  });

  it("strips whitespace from the payload", () => {
    const uri = getDataUri("aGVs\nbG8=", "text/plain");
    assert.strictEqual(uri, "data:text/plain;base64,aGVsbG8=");
  });
});
