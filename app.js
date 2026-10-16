"use strict";

/* ---------- State (saved to localStorage by persist(); see storage.js) ---------- */

// Ids only ever count up (and are restored on load), so a deleted id is never handed out again
let nextDeckId = 1;
let nextCardId = 1;

const newCard = (front, back) => ({ id: nextCardId++, front, back });

function newDeck(name, pairs = []) {
  return { id: nextDeckId++, name, cards: pairs.map(([front, back]) => newCard(front, back)) };
}

const seedDecks = () => [
  newDeck("Hiragana", [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]]),
  newDeck("Common Verbs", [["食べる", "to eat"], ["飲む", "to drink"], ["行く", "to go"], ["見る", "to see"]]),
  newDeck("Food & Drink", [["水", "water"], ["お茶", "tea"], ["ご飯", "cooked rice / meal"]]),
];

const saved = loadState();
if (saved) {
  nextDeckId = saved.nextDeckId;
  nextCardId = saved.nextCardId;
}

const state = {
  decks: saved ? saved.decks : seedDecks(),
  activeDeckId: saved ? saved.activeDeckId : null,
  cardIndex: 0, // position of the study card within the active deck (not saved)
  flipped: false,
  search: "", // view-only filter for the card list (not saved)
};
if (!saved) state.activeDeckId = state.decks[0].id;

let saveWarned = false;
function persist() {
  const ok = saveState({ decks: state.decks, activeDeckId: state.activeDeckId, nextDeckId, nextCardId });
  if (!ok && !saveWarned) {
    showNotice("Couldn’t save your changes in this browser, so they’ll be lost when you reload.");
  }
  if (ok && saveWarned) noticeEl.hidden = true; // saving works again
  saveWarned = !ok;
}

const getDeck = (id) => state.decks.find((d) => d.id === id);
const getActiveDeck = () => getDeck(state.activeDeckId);
const getCards = () => getActiveDeck()?.cards ?? [];
const getCurrentCard = () => getCards()[state.cardIndex] ?? null;

/* ---------- Elements ---------- */

const $ = (selector) => document.querySelector(selector);

const deckListEl = $("#deck-list");
const deckTitleEl = $("#deck-title");
const newDeckBtn = $("#new-deck");
const statusEl = $("#status");

const searchEl = $("#card-search");
const searchCountEl = $("#search-count");
const shuffleBtn = $("#shuffle");
const newCardBtn = $("#new-card");

const flashcardEl = $("#flashcard");
const frontFaceEl = $("#card-front");
const backFaceEl = $("#card-back");
const frontTextEl = $("#card-front-text");
const backTextEl = $("#card-back-text");
const cardCounterEl = $("#card-counter");
const playerDisplayEl = $("#player-display");
const progressFillEl = $("#progress-fill");
const editCardBtn = $("#edit-card");
const deleteCardBtn = $("#delete-card");
const prevBtn = $("#prev-card");
const flipBtn = $("#flip-card");
const nextBtn = $("#next-card");
const cardListEl = $("#card-list");
const studyEmptyEl = $("#study-empty");
const studyEmptyIconEl = $("#study-empty-icon");
const studyEmptyTitleEl = $("#study-empty-title");
const studyEmptyTextEl = $("#study-empty-text");
const studyEmptyActionBtn = $("#study-empty-action");
const cardActionsEl = $(".card-actions");
const controlsEl = $(".controls");
const noticeEl = $("#app-notice");
const noticeTextEl = $("#app-notice-text");

const modalEl = $("#modal");
const modalFormEl = $("#modal-form");
const modalTitleEl = $("#modal-title");
const modalDescEl = $("#modal-desc");
const modalDeckFieldEl = $("#modal-field");
const modalCardFieldsEl = $("#modal-card-fields");
const deckInputEl = $("#deck-name");
const deckErrorEl = $("#deck-name-error");
const frontInputEl = $("#card-front-input");
const frontErrorEl = $("#card-front-error");
const backInputEl = $("#card-back-input");
const backErrorEl = $("#card-back-error");
const modalCancelBtn = $("#modal-cancel");
const modalConfirmBtn = $("#modal-confirm");

// Everything behind the modal gets `inert` while it is open
const pageRegions = ["aside", "main", "footer"].map((tag) => $(tag));

/* ---------- Helpers ---------- */

function announce(message) {
  statusEl.textContent = "";
  // Re-set on the next frame so repeated identical messages are still announced
  requestAnimationFrame(() => (statusEl.textContent = message));
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function iconButton(action, id, icon, label, danger = false) {
  const btn = el("button", { type: "button", className: "icon-btn" + (danger ? " icon-btn-danger" : ""), textContent: icon });
  btn.dataset.action = action;
  btn.dataset.id = String(id);
  btn.setAttribute("aria-label", label);
  return btn;
}

// Sound effects live in sounds.js; this quietly does nothing if that file did not load
const sfx = (name) => {
  if (typeof playSound === "function") playSound(name);
};

// A friendly empty state: icon, title, short instruction, optional action button.
// data-empty-action buttons are handled by one listener at the bottom of this file.
function emptyState({ icon, title, text, actionLabel, action, compact = false }) {
  const item = el(
    "li",
    { className: "empty-state" + (compact ? " empty-compact" : "") },
    el("span", { className: "empty-icon", ariaHidden: "true" }, icon),
    el("h3", { className: "empty-title" }, title),
    el("p", { className: "empty-text" }, text)
  );
  item.querySelector(".empty-icon").setAttribute("aria-hidden", "true");
  if (actionLabel) {
    const button = el("button", { type: "button", className: "btn btn-ghost btn-small" }, actionLabel);
    button.dataset.emptyAction = action;
    item.append(button);
  }
  return item;
}

// Visible, dismissible message for problems the user should know about (e.g. changes not saved)
function showNotice(message) {
  noticeTextEl.textContent = message;
  noticeEl.hidden = false;
}

const shorten = (text, max = 30) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

/* ---------- Rendering: decks ---------- */

function renderDecks() {
  deckListEl.replaceChildren();

  if (state.decks.length === 0) {
    deckListEl.append(
      emptyState({ icon: "📚", title: "No decks yet", text: "Create your first deck to start adding cards.", actionLabel: "+ New Deck", action: "new-deck", compact: true })
    );
    return;
  }

  for (const deck of state.decks) {
    const isActive = deck.id === state.activeDeckId;

    const selectBtn = el(
      "button",
      { type: "button", className: "deck-item" + (isActive ? " is-active" : "") },
      el("span", { className: "deck-name" }, deck.name),
      el("span", { className: "deck-count" }, String(deck.cards.length))
    );
    selectBtn.dataset.action = "select";
    selectBtn.dataset.id = String(deck.id);
    if (isActive) selectBtn.setAttribute("aria-current", "true");

    deckListEl.append(
      el(
        "li",
        { className: "deck-row" },
        selectBtn,
        iconButton("edit", deck.id, "✎", `Rename deck ${deck.name}`),
        iconButton("delete", deck.id, "🗑", `Delete deck ${deck.name}`, true)
      )
    );
  }
}

function renderTitle() {
  const deck = getActiveDeck();
  deckTitleEl.textContent = deck ? deck.name : "No deck selected";
}

/* ---------- Rendering: study card + flip ---------- */

function setFaceText(node, text) {
  node.textContent = text;
  node.classList.toggle("is-long", text.length > 24);
}

function setFlipped(value) {
  state.flipped = value;
  flashcardEl.classList.toggle("is-flipped", value);
  frontFaceEl.setAttribute("aria-hidden", String(value));
  backFaceEl.setAttribute("aria-hidden", String(!value));
  flipBtn.setAttribute("aria-pressed", String(value));
}

// Turn the card face-up with no animation, so the next card's answer is never
// visible while the old card spins back.
function resetFlipInstantly() {
  flashcardEl.classList.add("no-anim");
  setFlipped(false);
  void flashcardEl.offsetWidth; // commit the un-animated state before re-enabling transitions
  flashcardEl.classList.remove("no-anim");
}

function renderStudy({ resetFlip = true } = {}) {
  const deck = getActiveDeck();
  const cards = getCards();

  // Keep the index in range after any change to the deck (before looking the card up)
  state.cardIndex = Math.min(Math.max(state.cardIndex, 0), Math.max(cards.length - 1, 0));
  const card = getCurrentCard();

  if (resetFlip || !card) resetFlipInstantly();

  if (card) {
    setFaceText(frontTextEl, card.front);
    setFaceText(backTextEl, card.back);
    cardCounterEl.textContent = `Card ${state.cardIndex + 1} of ${cards.length}`;
    progressFillEl.style.width = `${((state.cardIndex + 1) / cards.length) * 100}%`;
  } else {
    setFaceText(frontTextEl, "");
    setFaceText(backTextEl, "");
    cardCounterEl.textContent = "0 cards";
  }

  const hasCards = cards.length > 0;

  // Nothing to study: show an explanation and the next step instead of an empty card
  studyEmptyEl.hidden = hasCards;
  flashcardEl.hidden = !hasCards;
  playerDisplayEl.hidden = !hasCards;
  cardActionsEl.hidden = !hasCards;
  controlsEl.hidden = !hasCards;
  if (!hasCards) {
    if (deck) {
      studyEmptyIconEl.textContent = "🍡";
      studyEmptyTitleEl.textContent = "No cards yet";
      studyEmptyTextEl.textContent = `Add your first card to “${deck.name}” and start studying.`;
      studyEmptyActionBtn.textContent = "+ New Card";
      studyEmptyActionBtn.dataset.emptyAction = "new-card";
    } else {
      studyEmptyIconEl.textContent = "🌱";
      studyEmptyTitleEl.textContent = "No deck selected";
      studyEmptyTextEl.textContent = "Create a deck, or pick one from the list, to start studying.";
      studyEmptyActionBtn.textContent = "+ New Deck";
      studyEmptyActionBtn.dataset.emptyAction = "new-deck";
    }
  }
  searchEl.disabled = !deck;
  newCardBtn.disabled = !deck;
  shuffleBtn.disabled = cards.length < 2;
  prevBtn.disabled = cards.length < 2;
  nextBtn.disabled = cards.length < 2;
  flipBtn.disabled = !hasCards;
  editCardBtn.disabled = !hasCards;
  deleteCardBtn.disabled = !hasCards;
}

function renderCardList() {
  cardListEl.replaceChildren();
  searchCountEl.textContent = "";
  const deck = getActiveDeck();

  if (!deck) {
    cardListEl.append(emptyState({ icon: "🌱", title: "No deck selected", text: "Pick or create a deck to see its cards.", compact: true }));
    return;
  }
  if (deck.cards.length === 0) {
    cardListEl.append(emptyState({ icon: "🍡", title: "No cards yet", text: "Use “New Card” above to add your first one.", compact: true }));
    return;
  }

  const query = state.search.trim().toLowerCase();
  const current = getCurrentCard();
  let shown = 0;

  deck.cards.forEach((card, index) => {
    if (query && !card.front.toLowerCase().includes(query) && !card.back.toLowerCase().includes(query)) return;
    shown++;

    const isCurrent = current && card.id === current.id;
    const mainBtn = el(
      "button",
      { type: "button", className: "card-row-main" + (isCurrent ? " is-current" : "") },
      el("span", { className: "card-row-front" }, card.front),
      el("span", { className: "card-row-arrow", ariaHidden: "true" }, "→"),
      el("span", { className: "card-row-back" }, card.back)
    );
    mainBtn.dataset.action = "goto-card";
    mainBtn.dataset.id = String(card.id);
    mainBtn.dataset.index = String(index);
    mainBtn.setAttribute("aria-label", `Study card ${index + 1}: ${shorten(card.front)}`);
    if (isCurrent) mainBtn.setAttribute("aria-current", "true");

    cardListEl.append(
      el(
        "li",
        { className: "card-row" },
        mainBtn,
        iconButton("edit-card", card.id, "✎", `Edit card ${shorten(card.front)}`),
        iconButton("delete-card", card.id, "🗑", `Delete card ${shorten(card.front)}`, true)
      )
    );
  });

  if (shown === 0) {
    cardListEl.append(
      emptyState({
        icon: "🔍",
        title: "No cards found",
        text: `Nothing matches “${state.search.trim()}”. Try a different word.`,
        actionLabel: "Clear search",
        action: "clear-search",
        compact: true,
      })
    );
  }

  if (query) {
    const total = deck.cards.length;
    searchCountEl.textContent =
      shown === 0 ? "No matches" : `${shown} of ${total} ${total === 1 ? "card matches" : "cards match"}`;
  }
}

function renderAll({ resetFlip = true } = {}) {
  renderDecks();
  renderTitle();
  renderStudy({ resetFlip });
  renderCardList();
}

// The search box only changes what the list shows; it never touches the saved cards.
// Changing the query cancels any pending debounced update so an old query can't land late.
let searchTimer = null;
const SEARCH_DEBOUNCE_MS = 300;

function applySearch(value) {
  clearTimeout(searchTimer);
  state.search = value;
  if (searchEl.value !== value) searchEl.value = value;
  renderCardList();
}

// Switching to another deck: start at its first card, face-up, with no search filter
function showDeck(id) {
  state.activeDeckId = id;
  state.cardIndex = 0;
  clearTimeout(searchTimer);
  state.search = "";
  searchEl.value = "";
  persist(); // remembers the last active deck
  renderAll();
}

/* ---------- Study navigation ---------- */

function go(delta) {
  const n = getCards().length;
  if (n < 2) return;
  sfx(delta > 0 ? "next" : "prev");
  state.cardIndex = (state.cardIndex + delta + n) % n;
  renderStudy({ resetFlip: true });
  renderCardList();
  announce(`Card ${state.cardIndex + 1} of ${n}. Front: ${getCurrentCard().front}`);
}

function flipCard() {
  const card = getCurrentCard();
  if (!card) return;
  sfx("flip");
  setFlipped(!state.flipped);
  announce(state.flipped ? `Back: ${card.back}` : `Front: ${card.front}`);
}

function shuffleCards() {
  const cards = getCards();
  if (cards.length < 2) return;
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  persist();
  state.cardIndex = 0;
  renderStudy({ resetFlip: true });
  renderCardList();
  sfx("shuffle");
  announce("Cards shuffled");
}

/* ---------- Modal (focus trap, ESC, return focus) ---------- */

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], select, [tabindex]:not([tabindex="-1"])';

let modalOpener = null;
let modalReturnTarget = null; // optional: () => element to focus after close
let modalFallbackTarget = null; // optional: () => element to use if the opener is gone/disabled
let modalSubmit = null;

const isModalOpen = () => !modalEl.hidden;

function getFocusable() {
  return [...modalEl.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
}

function setError(input, errorEl, message) {
  errorEl.textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function clearErrors() {
  setError(deckInputEl, deckErrorEl, "");
  setError(frontInputEl, frontErrorEl, "");
  setError(backInputEl, backErrorEl, "");
}

/**
 * kind: "deck" (name field), "card" (front + back fields) or "confirm" (no fields).
 */
function openModal({ kind, title, description = "", values = {}, confirmLabel, danger = false, onSubmit, returnTarget, fallbackTarget }) {
  modalOpener = document.activeElement;
  modalReturnTarget = returnTarget ?? null;
  modalFallbackTarget = fallbackTarget ?? null;
  modalSubmit = onSubmit;

  modalTitleEl.textContent = title;
  modalDescEl.textContent = description;
  modalDescEl.hidden = !description;
  modalDeckFieldEl.hidden = kind !== "deck";
  modalCardFieldsEl.hidden = kind !== "card";
  deckInputEl.value = values.name ?? "";
  frontInputEl.value = values.front ?? "";
  backInputEl.value = values.back ?? "";
  clearErrors();
  modalConfirmBtn.textContent = confirmLabel;
  modalConfirmBtn.classList.toggle("btn-danger", danger);
  modalConfirmBtn.classList.toggle("btn-primary", !danger);

  modalEl.hidden = false;
  pageRegions.forEach((region) => (region.inert = true));

  // Fields: focus the first one. Confirm dialog: focus Cancel (the safe choice).
  const firstField = kind === "deck" ? deckInputEl : kind === "card" ? frontInputEl : null;
  if (firstField) {
    firstField.focus();
    firstField.select();
  } else {
    modalCancelBtn.focus();
  }
}

function closeModal() {
  if (!isModalOpen()) return;
  modalEl.hidden = true;
  pageRegions.forEach((region) => (region.inert = false));

  const usable = (node) => node && node.isConnected && !node.disabled;
  const candidates = [
    modalReturnTarget?.(),
    modalOpener,
    modalFallbackTarget?.(),
    deckListEl.querySelector(".deck-item.is-active"),
    newDeckBtn,
  ];
  candidates.find(usable)?.focus();

  modalOpener = modalReturnTarget = modalFallbackTarget = modalSubmit = null;
  if (externalChangePending) adoptSavedState();
}

// Bound once, never inside a render function
document.addEventListener("keydown", (event) => {
  if (isModalOpen()) {
    handleModalKeys(event);
  } else {
    handleStudyShortcuts(event);
  }
});

function handleModalKeys(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  // Enter adds a new line in a textarea, so Ctrl/Cmd+Enter submits from there
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    modalFormEl.requestSubmit();
    return;
  }

  if (event.key === "Tab") {
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (!modalEl.contains(current)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function handleStudyShortcuts(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest("input, textarea, select, [contenteditable]")) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    go(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    go(1);
  } else if (event.key === " " && !target.closest("button, a, summary")) {
    // On a focused button, Space already clicks it natively
    event.preventDefault();
    flipCard();
  }
}

// Clicking the dim backdrop (not the dialog itself) closes it
modalEl.addEventListener("mousedown", (event) => {
  if (event.target === modalEl) closeModal();
});
modalCancelBtn.addEventListener("click", closeModal);
deckInputEl.addEventListener("input", () => setError(deckInputEl, deckErrorEl, ""));
frontInputEl.addEventListener("input", () => setError(frontInputEl, frontErrorEl, ""));
backInputEl.addEventListener("input", () => setError(backInputEl, backErrorEl, ""));

modalFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  modalSubmit?.();
});

/* ---------- Deck CRUD ---------- */

// Returns an error message, or "" if the name is OK. `ignoreId` lets a deck keep its own name on rename.
function validateDeckName(name, ignoreId = null) {
  if (!name) return "Please enter a deck name.";
  const taken = state.decks.some((d) => d.id !== ignoreId && d.name.toLowerCase() === name.toLowerCase());
  if (taken) return "You already have a deck with that name.";
  return "";
}

function openNewDeckModal() {
  openModal({
    kind: "deck",
    title: "New deck",
    description: "Give your new deck a name.",
    confirmLabel: "Create deck",
    onSubmit() {
      const name = deckInputEl.value.trim();
      const error = validateDeckName(name);
      if (error) {
        sfx("oops");
        setError(deckInputEl, deckErrorEl, error);
        deckInputEl.focus();
        return;
      }
      const deck = newDeck(name);
      state.decks.push(deck);
      showDeck(deck.id); // also saves
      closeModal();
      sfx("success");
      announce(`Deck ${name} created`);
    },
  });
}

function openRenameDeckModal(id) {
  const deck = getDeck(id);
  if (!deck) return;
  openModal({
    kind: "deck",
    title: "Rename deck",
    values: { name: deck.name },
    confirmLabel: "Save",
    returnTarget: () => deckListEl.querySelector(`[data-action="edit"][data-id="${id}"]`),
    onSubmit() {
      const name = deckInputEl.value.trim();
      const error = validateDeckName(name, id);
      if (error) {
        sfx("oops");
        setError(deckInputEl, deckErrorEl, error);
        deckInputEl.focus();
        return;
      }
      deck.name = name;
      persist();
      renderDecks();
      renderTitle();
      closeModal();
      sfx("success");
      announce(`Deck renamed to ${name}`);
    },
  });
}

function openDeleteDeckModal(id) {
  const deck = getDeck(id);
  if (!deck) return;
  const n = deck.cards.length;
  openModal({
    kind: "confirm",
    title: `Delete “${deck.name}”?`,
    description: `This removes the deck${n ? ` and its ${n} ${n === 1 ? "card" : "cards"}` : ""}. This can’t be undone.`,
    confirmLabel: "Delete",
    danger: true,
    onSubmit() {
      const index = state.decks.findIndex((d) => d.id === id);
      state.decks.splice(index, 1);
      if (state.activeDeckId === id) {
        // Pick the neighbour that slid into this spot, else the new last deck
        const next = state.decks[index] ?? state.decks[index - 1] ?? null;
        showDeck(next ? next.id : null); // also saves
      } else {
        persist();
        renderDecks();
      }
      closeModal();
      sfx("delete");
      announce(`Deck ${deck.name} deleted`);
    },
  });
}

/* ---------- Card CRUD ---------- */

// `fromList` is true when the opener lives in the card list, which gets re-rendered
const cardListButton = (action, id) => () => cardListEl.querySelector(`[data-action="${action}"][data-id="${id}"]`);

function openCardModal(card = null, fromList = false) {
  const deck = getActiveDeck();
  if (!deck) return;
  const isEdit = card !== null;

  openModal({
    kind: "card",
    title: isEdit ? "Edit card" : "New card",
    description: isEdit ? "" : `Adding to “${deck.name}”.`,
    values: isEdit ? { front: card.front, back: card.back } : {},
    confirmLabel: isEdit ? "Save" : "Add card",
    returnTarget: isEdit && fromList ? cardListButton("edit-card", card.id) : undefined,
    onSubmit() {
      const front = frontInputEl.value.trim();
      const back = backInputEl.value.trim();
      setError(frontInputEl, frontErrorEl, front ? "" : "Please enter the front of the card.");
      setError(backInputEl, backErrorEl, back ? "" : "Please enter the back of the card.");
      if (!front || !back) {
        sfx("oops");
        (front ? backInputEl : frontInputEl).focus();
        return;
      }

      if (isEdit) {
        // Mutate the stored card, then refresh the views. The flip state is left alone.
        card.front = front;
        card.back = back;
        persist();
        renderStudy({ resetFlip: false });
        renderCardList();
        closeModal();
        sfx("success");
        announce("Card updated");
      } else {
        deck.cards.push(newCard(front, back));
        state.cardIndex = deck.cards.length - 1; // jump to the new card
        persist();
        applySearch(""); // show the full list so the new card is visible
        renderAll();
        closeModal();
        sfx("success");
        announce(`Card added. ${deck.cards.length} cards in ${deck.name}`);
      }
    },
  });
}

function openDeleteCardModal(card, fromList = false) {
  const deck = getActiveDeck();
  if (!deck) return;
  openModal({
    kind: "confirm",
    title: "Delete this card?",
    description: `“${shorten(card.front, 40)}” / “${shorten(card.back, 40)}” will be removed. This can’t be undone.`,
    confirmLabel: "Delete",
    danger: true,
    returnTarget: fromList ? undefined : () => deleteCardBtn,
    fallbackTarget: () => newCardBtn,
    onSubmit() {
      const index = deck.cards.findIndex((c) => c.id === card.id);
      if (index === -1) return closeModal();
      deck.cards.splice(index, 1);
      // Removing a card before the current one shifts the current card down by one
      if (index < state.cardIndex) state.cardIndex--;
      persist();
      renderAll();
      closeModal();
      sfx("delete");
      announce("Card deleted");
    },
  });
}

const findCard = (id) => getCards().find((c) => c.id === id) ?? null;

/* ---------- Wiring (delegated listeners; each bound once) ---------- */

newDeckBtn.addEventListener("click", openNewDeckModal);

// Buttons inside empty states (and the dismiss button on the notice)
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-empty-action]");
  if (button) {
    switch (button.dataset.emptyAction) {
      case "new-deck":
        openNewDeckModal();
        break;
      case "new-card":
        openCardModal();
        break;
      case "clear-search":
        applySearch("");
        searchEl.focus();
        break;
    }
    return;
  }
  if (event.target.closest("#app-notice-dismiss")) noticeEl.hidden = true;
});

deckListEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);

  switch (button.dataset.action) {
    case "select":
      if (id === state.activeDeckId) return;
      showDeck(id);
      // showDeck re-rendered the sidebar, so restore keyboard focus to the same deck
      deckListEl.querySelector(`[data-action="select"][data-id="${id}"]`)?.focus();
      break;
    case "edit":
      openRenameDeckModal(id);
      break;
    case "delete":
      openDeleteDeckModal(id);
      break;
  }
});

cardListEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const card = findCard(id);
  if (!card) return;

  switch (button.dataset.action) {
    case "goto-card":
      state.cardIndex = Number(button.dataset.index);
      renderStudy({ resetFlip: true });
      renderCardList();
      cardListEl.querySelector(`[data-action="goto-card"][data-id="${id}"]`)?.focus();
      announce(`Card ${state.cardIndex + 1} of ${getCards().length}. Front: ${card.front}`);
      break;
    case "edit-card":
      openCardModal(card, true);
      break;
    case "delete-card":
      openDeleteCardModal(card, true);
      break;
  }
});

newCardBtn.addEventListener("click", () => openCardModal());
editCardBtn.addEventListener("click", () => {
  const card = getCurrentCard();
  if (card) openCardModal(card);
});
deleteCardBtn.addEventListener("click", () => {
  const card = getCurrentCard();
  if (card) openDeleteCardModal(card);
});

prevBtn.addEventListener("click", () => go(-1));
nextBtn.addEventListener("click", () => go(1));
flipBtn.addEventListener("click", flipCard);
flashcardEl.addEventListener("click", flipCard);
shuffleBtn.addEventListener("click", shuffleCards);

// Debounced: wait until typing pauses. Clearing the box restores the full list immediately.
searchEl.addEventListener("input", () => {
  clearTimeout(searchTimer);
  if (searchEl.value === "") {
    applySearch("");
    return;
  }
  searchTimer = setTimeout(() => applySearch(searchEl.value), SEARCH_DEBOUNCE_MS);
});

// Another tab saved: adopt its data so this tab can't later overwrite it with stale state.
// If a dialog is open here, wait until it closes.
let externalChangePending = false;

function adoptSavedState() {
  externalChangePending = false;
  const latest = loadState();
  if (!latest) return;
  nextDeckId = latest.nextDeckId;
  nextCardId = latest.nextCardId;
  state.decks = latest.decks;
  state.activeDeckId = latest.activeDeckId;
  clearTimeout(searchTimer);
  state.search = "";
  searchEl.value = "";
  renderAll();
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  if (isModalOpen()) externalChangePending = true;
  else adoptSavedState();
});

renderAll();
if (!saved) persist(); // first visit: store the starter decks
if (typeof storageLoadProblem !== "undefined" && storageLoadProblem) {
  showNotice("Your saved cards couldn’t be read, so you’re seeing the starter decks. A copy of the old data was kept in this browser.");
}
