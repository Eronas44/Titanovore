/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * Ensures deterministic procedural city generation.
 */
export class PRNG {
  constructor(seed = 1337) {
    this.initialSeed = seed;
    this.state = seed;
  }

  reset(seed = this.initialSeed) {
    this.state = seed;
  }

  // Returns float in [0, 1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }
}
