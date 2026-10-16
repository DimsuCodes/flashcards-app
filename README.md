# Mochi Cards: a flashcards app

A vanilla HTML/CSS/JS flashcards app (no frameworks, no build step) with deck and card CRUD, a 3D flip study card,
LocalStorage persistence, search, sound effects, a light and an opt-in dark theme, and a Frutiger Aero / Y2K look.

## Run it

Open `index.html` in a browser, or right-click it in VS Code and choose **Open with Live Server**.
If the page looks broken after an edit, hard-refresh with Ctrl+Shift+R (the browser can keep an old copy of the HTML).

## Features by lab part

| Part | What is there |
| --- | --- |
| 1. Base UI & layout | Two-column CSS grid (fixed sidebar, fluid main), deck list with the active deck highlighted, toolbar (search, shuffle, new card), card area, prev/flip/next controls, footer instructions. Stacks on phones. |
| 2. Deck CRUD | "New Deck" modal, switch decks, rename, delete with a confirm dialog. |
| 3. Card CRUD + flip | "New Card" modal (Front/Back), edit and delete from the study view or the card list, CSS 3D flip that resets when the card changes. |
| 5. Persistence & search | Saves to LocalStorage on every change, restores decks, cards and the last active deck, debounced (300 ms) case-insensitive search with a match count. |
| 6. QA & polish | Empty states, error handling, accessibility audit, CSS-variable theming. |

Extras: sound effects (with a mute button), three small interactive characters, a media-player style progress display.

## Keyboard

- **Space** flips the card, **← / →** move between cards (ignored while typing in a field).
- **Esc** closes a dialog, **Tab** and **Shift+Tab** cycle inside it, **Ctrl/Cmd+Enter** submits it.
- A "Skip to main content" link appears on the first Tab press.

## Files

| File | Job |
| --- | --- |
| `index.html` | Markup: sidebar, main, one reusable modal, status/notice regions |
| `styles.css` | All styling. Colours, spacing and type come from CSS variables in `:root` (light) and `:root[data-theme="dark"]` |
| `app.js` | State, rendering, deck and card CRUD, modal (focus trap), study navigation, keyboard shortcuts |
| `storage.js` | `loadState()` / `saveState()` with versioning, validation and a backup of unreadable data |
| `sounds.js` | Web Audio sound effects and the mute button |
| `friends.js` | The little characters (colour and mood change when pressed) |
| `theme.js` | Light / dark button |

## Data and storage

State lives in memory and is saved to `localStorage` under `mochi-cards:state`:

```js
{ version: 1,
  decks: [{ id, name, cards: [{ id, front, back }] }],
  activeDeckId, nextDeckId, nextCardId }
```

- `loadState()` parses defensively: bad JSON or an unknown version is copied to `mochi-cards:state:backup`, the app
  starts with the starter decks, and a notice tells the user. Malformed decks or cards are dropped individually, and
  ids are re-checked so they stay unique.
- If saving fails (storage full or blocked) a visible notice appears and the app keeps working in memory.
- When another tab saves, this tab adopts the change so it can't overwrite it with stale data later.
- Search only changes the **view**: it never modifies the stored cards.

**How this differs from the lab's reference data model:** the reference keeps `cardsByDeckId`, string ids and
`createdAt` / `updatedAt` timestamps. This app nests `cards` inside each deck and uses numeric ids that only ever count up
(so a deleted id is never reused). UI state (`cardIndex`, `flipped`, `search`) is kept in the `state` object but is not saved.
Switching to the reference shape would be a `version: 2` migration in `migrate()`.

## Accessibility notes

- Every input has a real `<label>`; icon-only buttons have `aria-label`s; decorative emoji and SVG are `aria-hidden`.
- Visible `:focus-visible` rings everywhere; the modal traps focus, makes the page behind it `inert`, closes on Esc and
  returns focus to the button that opened it.
- Form errors use `role="alert"` and `aria-invalid`; changes (card added, deck deleted, search matches) are announced
  through `aria-live` regions.
- Colour pairs were measured against WCAG AA (4.5:1 for text) in both themes, and several were darkened to pass.
- Motion respects `prefers-reduced-motion`.

**Theming note:** the page is always light by default. The dark theme only turns on with the **Dark** button (it is
remembered). To follow the system setting instead, add `@media (prefers-color-scheme: dark)` around the dark variables.

## Known limits

- No automated tests: everything was checked by hand in the browser (keyboard-only runs, empty states, malformed
  storage, phone width).
- Two tabs editing at the same moment: the last save wins (a dialog open in one tab defers the other tab's update).
- Fonts load from Google Fonts, so the intended look needs an internet connection.

---

## Reflection

- **Where AI saved time.** The big scaffolding jobs: the responsive grid with CSS variables, the accessible modal
  (focus trap, Esc, return focus), the LocalStorage layer with versioning and a validator, and the SVG characters. The
  biggest win was iterating on looks: I pasted reference screenshots and got a restyle (Frutiger Aero, Y2K) in minutes
  instead of hand-tuning gradients. It also wrote a small script to measure colour contrast instead of me eyeballing it.
- **An AI bug I caught, and the fix.** Two. (1) After renaming a deck, keyboard focus was lost: the code closed the modal
  and *then* re-rendered the sidebar, so it tried to focus a button that had just been replaced. I found it by testing
  with the keyboard only, and fixed it by rendering first, then closing the modal, and looking up the return target
  lazily. (2) Deleting the last card of a deck briefly showed "No cards yet" even though cards remained: `renderStudy`
  looked up the current card *before* clamping the card index. Moving the clamp above the lookup fixed it.
- **A refactor for clarity.** The empty messages were three hand-built `<li>` elements with different markup. I replaced
  them with one `emptyState()` helper:

  ```js
  // before
  cardListEl.append(el("li", { className: "card-empty" }, "No cards yet. Add one with “+ New Card”."));

  // after
  cardListEl.append(emptyState({ icon: "🍡", title: "No cards yet", text: "Use “New Card” above to add your first one.", compact: true }));
  ```
  Icons, titles, instructions and an optional action button now come from one place, and the buttons use one delegated
  `data-empty-action` listener instead of a listener per message.
- **An accessibility improvement.** The modal is a real dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`,
  `aria-describedby`): focus moves into it, Tab and Shift+Tab wrap inside it, the rest of the page is made `inert`, Esc
  closes it and focus returns to the opener. Validation errors are tied to their fields with `aria-describedby` and
  `aria-invalid` and are announced with `role="alert"`.
- **Prompt changes that improved the output.** Vague prompts ("make it nicer") gave generic results; prompts with
  concrete acceptance checks worked better: "Tab cycles inside the modal", "refresh keeps decks intact", "delete the last
  card", "search must not mutate stored data". Asking for a *measured* contrast check (and for a stable-selector,
  single-delegated-listener design up front) caught problems the first draft had. Giving a reference image plus the
  constraints (no framework, keep class names consistent, reset animation state on navigation) produced code that
  needed far fewer fixes.
