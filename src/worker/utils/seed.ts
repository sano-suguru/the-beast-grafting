export function generateShopSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] === 0 ? 1 : buf[0]!;
}
