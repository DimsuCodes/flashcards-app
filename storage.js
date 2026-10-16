"use strict";

/*
 * localStorage helpers. Loaded before app.js, so loadState() and saveState() are globals.
 *
 * Saved shape (version 1):
 *   { version, decks: [{ id, name, cards: [{ id, front, back }] }],
 *     activeDeckId, nextDeckId, nextCardId }
 *
 * To change the shape later: bump STORAGE_VERSION and add a branch in migrate().
 */

const STORAGE_KEY = "mochi-cards:state";
const STORAGE_BACKUP_KEY = "mochi-cards:state:backup";
const STORAGE_VERSION = 1;

// Set to true when saved data existed but was unreadable (app.js tells the user)
let storageLoadProblem = false;

const MAX_DECK_NAME = 40;
const MAX_CARD_TEXT = 200;

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value) => Number.isInteger(value) && value > 0;
const cleanText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Returns the saved state, or null when nothing usable is stored (caller then starts fresh). */
function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode, disabled cookies): run in memory only
  }
  if (raw === null) return null;

  try {
    const state = migrate(JSON.parse(raw));
    if (state) return state;
  } catch {
    // fall through to the backup below
  }

  // Unreadable or from an unknown version. Keep a copy before the app starts fresh and
  // saves over it, so nothing is destroyed silently.
  try {
    localStorage.setItem(STORAGE_BACKUP_KEY, raw);
  } catch {
    // nothing more we can do
  }
  storageLoadProblem = true;
  console.warn(`Saved flashcards could not be read; a copy was kept under "${STORAGE_BACKUP_KEY}".`);
  return null;
}

/** Brings any known older version up to the current one, then validates it. */
function migrate(data) {
  if (!isPlainObject(data)) return null;
  switch (data.version) {
    case 1:
      return sanitize(data);
    default:
      return null; // unknown (e.g. newer) version: don't guess
  }
}

/** Keeps only well-formed decks/cards and recomputes the id counters so ids stay unique. */
function sanitize(data) {
  if (!Array.isArray(data.decks)) return null;

  const seenDeckIds = new Set();
  const seenCardIds = new Set();
  const decks = [];

  for (const rawDeck of data.decks) {
    if (!isPlainObject(rawDeck) || !isId(rawDeck.id) || seenDeckIds.has(rawDeck.id)) continue;
    const name = cleanText(rawDeck.name, MAX_DECK_NAME);
    if (!name) continue;
    seenDeckIds.add(rawDeck.id);

    const cards = [];
    for (const rawCard of Array.isArray(rawDeck.cards) ? rawDeck.cards : []) {
      if (!isPlainObject(rawCard) || !isId(rawCard.id) || seenCardIds.has(rawCard.id)) continue;
      const front = cleanText(rawCard.front, MAX_CARD_TEXT);
      const back = cleanText(rawCard.back, MAX_CARD_TEXT);
      if (!front || !back) continue;
      seenCardIds.add(rawCard.id);
      cards.push({ id: rawCard.id, front, back });
    }
    decks.push({ id: rawDeck.id, name, cards });
  }

  const maxId = (ids) => Math.max(0, ...ids);
  const activeDeckId = decks.some((d) => d.id === data.activeDeckId) ? data.activeDeckId : (decks[0]?.id ?? null);

  return {
    decks,
    activeDeckId,
    nextDeckId: Math.max(isId(data.nextDeckId) ? data.nextDeckId : 1, maxId(seenDeckIds) + 1),
    nextCardId: Math.max(isId(data.nextCardId) ? data.nextCardId : 1, maxId(seenCardIds) + 1),
  };
}

/** Writes the state. Returns false if the browser refused (quota exceeded, storage blocked). */
function saveState({ decks, activeDeckId, nextDeckId, nextCardId }) {
  const payload = { version: STORAGE_VERSION, decks, activeDeckId, nextDeckId, nextCardId };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
