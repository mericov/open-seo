import { AppError } from "@/server/lib/errors";

function sniffType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e)
    return "image/png";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp")
    return ascii(8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  return null;
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
        width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function pngToJpeg(bytes: Uint8Array) {
  const { decode, convertIndexedToRgb } = await import("fast-png");
  const { encode } = await import("jpeg-js");
  const png = decode(bytes);
  const pixels = png.palette ? convertIndexedToRgb(png) : png.data;
  const channels = png.palette ? (png.transparency ? 4 : 3) : png.channels;
  const scale = png.depth === 16 ? 257 : 1;
  const rgba = new Uint8Array(png.width * png.height * 4);
  for (let i = 0; i < png.width * png.height; i += 1) {
    const read = (c: number) => (pixels[i * channels + c] ?? 0) / scale;
    const gray = channels <= 2;
    const r = read(0);
    const g = gray ? r : read(1);
    const b = gray ? r : read(2);
    const alpha =
      channels === 4 ? read(3) / 255 : channels === 2 ? read(1) / 255 : 1;
    rgba[i * 4] = Math.round(r * alpha + 255 * (1 - alpha));
    rgba[i * 4 + 1] = Math.round(g * alpha + 255 * (1 - alpha));
    rgba[i * 4 + 2] = Math.round(b * alpha + 255 * (1 - alpha));
    rgba[i * 4 + 3] = 255;
  }
  const jpeg = encode({ width: png.width, height: png.height, data: rgba }, 90);
  return {
    bytes: new Uint8Array(jpeg.data),
    width: png.width,
    height: png.height,
  };
}

export async function normalizeMedia(bytes: Uint8Array) {
  const type = sniffType(bytes);
  if (type === "image/jpeg") {
    const size = jpegSize(bytes);
    return {
      bytes,
      contentType: type,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }
  if (type === "image/png") {
    const converted = await pngToJpeg(bytes);
    return { ...converted, contentType: "image/jpeg" };
  }
  if (type === "video/mp4" || type === "video/quicktime") {
    return { bytes, contentType: type, width: null, height: null };
  }
  throw new AppError(
    "VALIDATION_ERROR",
    type === "image/webp"
      ? "WebP is not supported by Instagram. Export the image as JPEG or PNG."
      : "Unsupported file. Use JPEG, PNG or MP4.",
  );
}
