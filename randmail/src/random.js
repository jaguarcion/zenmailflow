import { randomInt } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomLabel(len) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  // Ensure it starts with a letter (valid DNS label / localpart).
  if (!/[a-z]/.test(out[0])) {
    out = ALPHABET[randomInt(26)] + out.slice(1);
  }
  return out;
}
