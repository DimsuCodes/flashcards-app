"use strict";

/* The little jellies react when pressed (mouse, touch or keyboard): they pull a happy face,
 * hop or dance, pop hearts and a speech bubble, and switch to the next colour + mood.
 * Purely decorative: nothing here touches the decks or cards. */

// Each theme is one colour + mood. The vars feed the CSS variables used by the SVG gradients.
const JELLY_THEMES = [
  {
    mood: "Feeling minty fresh!", face: "sig",
    vars: { body: "#e6ffee", glow0: "#46ee62", glow1: "#86f9a2", glow2: "#c4ffd6", g2a: "#c9ffd8", g2b: "#e6ffee", ground: "#4cf06a", rim: "#7fe3a0", "crown-a": "#9cf27a", "crown-b": "#46d96a", ink: "#1e6b3a" },
    sparkles: ["#46ee62", "#f3ff7a", "#ffffff"],
  },
  {
    mood: "Feeling dreamy… zzz", face: "sleepy",
    vars: { body: "#e6f0ff", glow0: "#3d7bff", glow1: "#7fb0ff", glow2: "#cfe2ff", g2a: "#9bf0ff", g2b: "#d6f8ff", ground: "#5b95ff", rim: "#7fa8ff", "crown-a": "#d7e6ff", "crown-b": "#9fc0ff", ink: "#2c3a8c" },
    sparkles: ["#3d7bff", "#9bf0ff", "#ff9be8"],
  },
  {
    mood: "Feeling berry cute!", face: "sig",
    vars: { body: "#f6e9ff", glow0: "#ff5ff0", glow1: "#f08aff", glow2: "#f6c6ff", g2a: "#8f6bff", g2b: "#b8a0ff", ground: "#c36bff", rim: "#b58cff", "crown-a": "#e6c8ff", "crown-b": "#b48cff", ink: "#3f2a9c" },
    sparkles: ["#ff5ff0", "#8f6bff", "#ffd36b"],
  },
  {
    mood: "Feeling sunny!", face: "sig",
    vars: { body: "#fff6e0", glow0: "#ffae3d", glow1: "#ffd36b", glow2: "#ffecb8", g2a: "#ff9bb0", g2b: "#ffd9e0", ground: "#ffbf5a", rim: "#ffc978", "crown-a": "#fff08a", "crown-b": "#ffc96b", ink: "#8a3f0c" },
    sparkles: ["#ffae3d", "#ff9bb0", "#fff08a"],
  },
  {
    mood: "Feeling splashy!", face: "sleepy",
    vars: { body: "#e2fbff", glow0: "#2fd6e8", glow1: "#7fe8f2", glow2: "#c9f8fc", g2a: "#8fb8ff", g2b: "#d6e6ff", ground: "#4adbea", rim: "#7ce4ee", "crown-a": "#c9f8fc", "crown-b": "#8fe3ee", ink: "#155a6b" },
    sparkles: ["#2fd6e8", "#8fb8ff", "#ffffff"],
  },
];

// Which colour each character starts with (matches the first screen), and where it is saved
const JELLY_SLOTS = { sit: 0, hero: 1, play: 2 };
const JELLY_STORAGE_KEY = "mochi-cards:jellies";

const REACTION_FACES = ["happy", "love", "star"];
const PARTICLES = ["♡", "♥", "✦", "★"];
const REACT_MS = 1000; // how long the happy pose lasts
const BUBBLE_MS = 1800; // how long the speech bubble stays
const MAX_PARTICLES = 12; // cap so mashing a character can't pile up elements

const friendState = new WeakMap(); // wrapper -> { slot, themeIndex, reactTimer, bubbleTimer }

const WRAPPERS = ".sidebar-friend, .card-friend, .mascot";
const slotOf = (wrap) => (wrap.matches(".sidebar-friend") ? "sit" : wrap.matches(".card-friend") ? "play" : "hero");

function loadSavedThemes() {
  try {
    const saved = JSON.parse(localStorage.getItem(JELLY_STORAGE_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveThemes() {
  const data = {};
  document.querySelectorAll(WRAPPERS).forEach((wrap) => {
    const info = friendState.get(wrap);
    if (info) data[info.slot] = info.themeIndex;
  });
  try {
    localStorage.setItem(JELLY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // colours just reset on reload
  }
}

function applyTheme(wrap, index) {
  const svg = wrap.querySelector("svg.jelly");
  const theme = JELLY_THEMES[index];
  if (!svg || !theme) return;
  svg.dataset.face = theme.face;
  // Plain shapes pick colours up from CSS variables...
  for (const [name, value] of Object.entries(theme.vars)) svg.style.setProperty(`--j-${name}`, value);
  // ...but browsers do not always repaint gradients when a variable inside a stop changes,
  // so the gradient stops (classes js-body, js-glow0, ...) are coloured directly.
  svg.querySelectorAll("stop[class*='js-']").forEach((stop) => {
    const key = [...stop.classList].find((c) => c.startsWith("js-")).slice(3);
    if (theme.vars[key]) stop.style.stopColor = theme.vars[key];
  });
}

function setupFriends() {
  // No colour fade for the first paint, only when a character is pressed
  document.documentElement.classList.add("jelly-init");
  const saved = loadSavedThemes();
  document.querySelectorAll(WRAPPERS).forEach((wrap) => {
    const slot = slotOf(wrap);
    const savedIndex = Number.isInteger(saved[slot]) && saved[slot] >= 0 && saved[slot] < JELLY_THEMES.length ? saved[slot] : JELLY_SLOTS[slot];
    friendState.set(wrap, { slot, themeIndex: savedIndex, reactTimer: 0, bubbleTimer: 0 });
    applyTheme(wrap, savedIndex);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("jelly-init")));
}

function reactFriend(button) {
  const wrap = button.closest(WRAPPERS);
  const info = friendState.get(wrap);
  const bubble = wrap.querySelector(".friend-bubble");

  // Next colour and mood
  info.themeIndex = (info.themeIndex + 1) % JELLY_THEMES.length;
  const theme = JELLY_THEMES[info.themeIndex];
  applyTheme(wrap, info.themeIndex);
  saveThemes();

  // A random delighted face for this reaction: smiling, heart eyes or star eyes
  const svg = wrap.querySelector("svg.jelly");
  svg.dataset.react = REACTION_FACES[Math.floor(Math.random() * REACTION_FACES.length)];

  if (typeof playSound === "function") playSound(info.slot === "sit" ? "bunny" : "mochi");

  // Restart the happy pose even if it is already playing
  clearTimeout(info.reactTimer);
  wrap.classList.remove("is-reacting");
  void wrap.offsetWidth; // let the browser see the class removal so the animation replays
  wrap.classList.add("is-reacting");
  info.reactTimer = setTimeout(() => wrap.classList.remove("is-reacting"), REACT_MS);

  // Speech bubble with the new mood. Setting new text also makes screen readers announce it.
  bubble.textContent = theme.mood;
  bubble.classList.add("show");
  clearTimeout(info.bubbleTimer);
  info.bubbleTimer = setTimeout(() => {
    bubble.classList.remove("show");
    bubble.textContent = "";
  }, BUBBLE_MS);

  spawnParticles(wrap, theme.sparkles);
}

function spawnParticles(wrap, colors) {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("span");
    particle.className = "heart-pop";
    particle.setAttribute("aria-hidden", "true");
    particle.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
    particle.style.color = colors[Math.floor(Math.random() * colors.length)];
    particle.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 70)}px`);
    particle.style.animationDelay = `${i * 70}ms`;
    particle.addEventListener("animationend", () => particle.remove());
    wrap.append(particle);
  }

  const all = wrap.querySelectorAll(".heart-pop");
  for (let i = 0; i < all.length - MAX_PARTICLES; i++) all[i].remove();
}

// One delegated listener covers every character
document.addEventListener("click", (event) => {
  const button = event.target.closest(".friend-btn");
  if (button) reactFriend(button);
});

setupFriends();
