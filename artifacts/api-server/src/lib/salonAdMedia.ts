export const MAX_SALON_AD_BYTES = 20 * 1024 * 1024;

// Check the ISO BMFF structure and require a video track; don't trust filename or MIME alone.
export function isMp4Video(file: Buffer): boolean {
  type Box = { type: string; start: number; end: number };
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (end - start < 8 || result.length >= 2048) throw new Error("Invalid MP4 box");
      const length = file.readUInt32BE(start);
      const header = length === 1 ? 16 : 8;
      if (end - start < header) throw new Error("Invalid MP4 header");
      const size = length === 1 ? Number(file.readBigUInt64BE(start + 8)) : length || end - start;
      if (size < header || size > end - start) throw new Error("Invalid MP4 length");
      result.push({ type: file.toString("ascii", start + 4, start + 8), start: start + header, end: start + size });
      start += size;
    }
    return result;
  }
  try {
    const top = boxes(0, file.length);
    const [type] = top;
    const movie = top.find((box) => box.type === "moov");
    if (type?.type !== "ftyp" || type.end - type.start < 8 || !movie ||
        !top.some((box) => box.type === "mdat" && box.start < box.end)) return false;
    const brands = file.subarray(type.start, Math.min(type.end, type.start + 80)).toString("ascii");
    if (!/(isom|iso[2-9]|mp4[12]|avc1|M4V )/.test(brands)) return false;
    return boxes(movie.start, movie.end).some((track) => track.type === "trak" &&
      boxes(track.start, track.end).some((media) => media.type === "mdia" &&
        boxes(media.start, media.end).some((handler) => handler.type === "hdlr" &&
          handler.end - handler.start >= 12 && file.toString("ascii", handler.start + 8, handler.start + 12) === "vide")));
  } catch {
    return false;
  }
}

export function salonAdRange(range: string | undefined, size: number) {
  if (range === undefined) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  const a = match[1] ? Number(match[1]) : undefined;
  const b = match[2] ? Number(match[2]) : undefined;
  if ([a, b].some((value) => value !== undefined && !Number.isSafeInteger(value))) return null;
  if (a === undefined) {
    if (!b) return null;
    return { start: Math.max(0, size - b), end: size - 1, partial: true };
  }
  if (a >= size || (b !== undefined && b < a)) return null;
  return { start: a, end: Math.min(b ?? size - 1, size - 1), partial: true };
}
