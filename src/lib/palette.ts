// Deterministic per-artist duotone, standing in for a photo when there isn't
// one — same idea as the website's .img-ph gradient placeholder.
const DUOTONES: Array<[string, string]> = [
  ["#3a1d3e", "#5a2540"],
  ["#1c1020", "#2a1a30"],
  ["#251229", "#3a1010"],
  ["#2a0e2a", "#3a1d3e"],
  ["#1a0d1f", "#2a1a30"],
];

export function duotoneFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return DUOTONES[hash % DUOTONES.length];
}
