import { describe, expect, it } from "vitest";

import { ensureJfif, fitWithin, isJfif, isPng, MAX_EDGE, timecode } from "@/lib/images";

// A camera JPEG starts with an EXIF APP1 segment (FF D8 FF E1), which the
// network's model gateway refuses.
const exifJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xd9]);
const jfifJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("the formats the record accepts", () => {
  it("recognises JFIF and PNG by their first bytes, and nothing else", () => {
    expect(isJfif(jfifJpeg)).toBe(true);
    expect(isJfif(exifJpeg)).toBe(false);
    expect(isPng(png)).toBe(true);
    expect(isPng(jfifJpeg)).toBe(false);
    expect(isJfif(new Uint8Array())).toBe(false);
  });

  it("leaves a JFIF JPEG byte for byte as it is", () => {
    expect(ensureJfif(jfifJpeg)).toBe(jfifJpeg);
  });

  it("gives any other JPEG the JFIF segment right after its start marker, keeping every later byte", () => {
    const out = ensureJfif(exifJpeg);
    expect(isJfif(out)).toBe(true);
    expect(out.length).toBe(exifJpeg.length + 18);
    expect(Array.from(out.subarray(6, 11))).toEqual([0x4a, 0x46, 0x49, 0x46, 0x00]); // "JFIF\0"
    expect(Array.from(out.subarray(20))).toEqual(Array.from(exifJpeg.subarray(2)));
  });

  it("refuses bytes that are not a JPEG at all", () => {
    expect(() => ensureJfif(png)).toThrow(/did not produce a JPEG/);
  });
});

describe("redraw size", () => {
  it("brings the long edge down to the limit and keeps the proportions", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_EDGE, height: 768 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: MAX_EDGE });
  });

  it("never enlarges a small image and never reaches zero", () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(100_000, 1)).toEqual({ width: MAX_EDGE, height: 1 });
  });

  it("accepts a smaller edge for the retry that shrinks an image under the size limit", () => {
    expect(fitWithin(4032, 3024, 819)).toEqual({ width: 819, height: 614 });
  });
});

describe("video frames", () => {
  it("labels a frame by its minute and second", () => {
    expect(timecode(0)).toBe("00:00");
    expect(timecode(75.9)).toBe("01:15");
    expect(timecode(-3)).toBe("00:00");
  });
});
