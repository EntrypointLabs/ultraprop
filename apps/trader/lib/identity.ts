/**
 * Human-readable account handles. We surface a stable generated handle like
 * `rabbit_mx` instead of a raw wallet address everywhere an address would be
 * SHOWN to a user — the real address still drives internal plumbing (vault ids,
 * `/api/account`, the `profile/[wallet]` route), this only changes what's
 * displayed. A future option is real on-chain SuiNS naming; this is a
 * deterministic generated handle for now.
 *
 * Pure and deterministic: same address → same handle, every time. No IO.
 */

const WORDS = [
  "amber",
  "azure",
  "badger",
  "bison",
  "cobalt",
  "coral",
  "dingo",
  "egret",
  "falcon",
  "gecko",
  "golden",
  "heron",
  "ibex",
  "jade",
  "kestrel",
  "lynx",
  "mantis",
  "marlin",
  "narwhal",
  "noble",
  "ocelot",
  "otter",
  "panther",
  "puffin",
  "quartz",
  "quokka",
  "rabbit",
  "raven",
  "scarlet",
  "silent",
  "solar",
  "stoat",
  "swift",
  "tapir",
  "teal",
  "urchin",
  "viper",
  "walrus",
  "weasel",
  "wombat",
] as const;

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * FNV-1a over the string, finished with an integer avalanche. Plain FNV-1a
 * leaves its low bits weakly mixed for inputs sharing a long prefix (so
 * `addr`, `addr:s1`, `addr:s2` would collapse to almost the same value mod a
 * small base); the xorshift-multiply finalizer diffuses every input bit across
 * the word, making the three salted slots effectively independent. Identical in
 * every JS runtime.
 */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A stable, human-readable handle derived from a wallet address, e.g.
 * `rabbit_mx`: one word from a curated list plus a 2-char suffix. Each of the
 * three slots (word, suffix char 1, suffix char 2) is drawn from an
 * independently salted hash so they vary independently rather than moving in
 * lockstep — that keeps the effective space near 41 × 36² ≈ 53k handles and
 * collisions low.
 */
export function accountHandle(address: string): string {
  const key = address.trim().toLowerCase();
  if (!key) return "trader";

  const word = WORDS[hash32(key) % WORDS.length];
  const c1 = SUFFIX_ALPHABET[hash32(`${key}:s1`) % SUFFIX_ALPHABET.length];
  const c2 = SUFFIX_ALPHABET[hash32(`${key}:s2`) % SUFFIX_ALPHABET.length];

  return `${word}_${c1}${c2}`;
}
