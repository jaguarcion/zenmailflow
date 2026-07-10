import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';

// In-memory map keyed by the full mail domain (`<label>.<baseDomain>`),
// persisted to a JSON file so mailboxes survive restarts.
// value: { chatId, address, label, domain, createdAt }
let mailboxes = new Map();

export async function loadStore() {
  try {
    const raw = await readFile(config.storeFile, 'utf8');
    const obj = JSON.parse(raw);
    mailboxes = new Map(Object.entries(obj));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    mailboxes = new Map();
  }
}

async function persist() {
  await mkdir(dirname(config.storeFile), { recursive: true });
  const obj = Object.fromEntries(mailboxes);
  await writeFile(config.storeFile, JSON.stringify(obj, null, 2));
}

export function hasDomain(domain) {
  return mailboxes.has(domain.toLowerCase());
}

export function getByDomain(domain) {
  return mailboxes.get(domain.toLowerCase());
}

export function listByChat(chatId) {
  return [...mailboxes.values()].filter((m) => String(m.chatId) === String(chatId));
}

export async function addMailbox(entry) {
  mailboxes.set(entry.domain.toLowerCase(), entry);
  await persist();
}

export async function removeByDomain(domain) {
  const ok = mailboxes.delete(domain.toLowerCase());
  if (ok) await persist();
  return ok;
}
