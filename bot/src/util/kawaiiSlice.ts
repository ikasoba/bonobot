export function kawaiiSlice(src: string, start: number, length: number) {
  if (src.length - start > length) {
    return src.slice(start, start + length) + "...";
  }
  return src;
}
