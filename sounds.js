"use strict";

/*
 * Cute UI sounds, synthesized with the Web Audio API (no audio files needed).
 *
 * playSound(name) is a global that app.js and friends.js call for specific moments.
 * This file also plays a soft "pop" for any other button click.
 * The Sound button in the header mutes everything, and the choice is remembered.
 */

const SOUND_KEY = "mochi-cards:sound";
const MASTER_VOLUME = 0.4;
const MIN_GAP_MS = 40; // ignore the same sound twice within this window (stops machine-gun clicks)

let soundEnabled = true;
try {
  soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
} catch {
  // storage blocked: sound just stays on for this visit
}

let audioCtx = null;
let masterGain = null;
const lastPlayed = {};

// Browsers only allow audio after a user gesture, so the context is created on first use
function getAudio() {
  if (audioCtx) return audioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioCtx = new AudioContextClass();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = MASTER_VOLUME;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

// One soft note: pitch glides from `from` to `to`, with a quick fade in and out
function tone({ from, to = from, dur = 0.1, type = "sine", vol = 0.2, delay = 0 }) {
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + dur);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(gain).connect(masterGain);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

const jitter = () => 1 + (Math.random() * 0.16 - 0.08); // slight pitch wobble so repeats don't sound robotic
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

const SOUNDS = {
  // any ordinary button
  pop() {
    const r = jitter();
    tone({ from: 520 * r, to: 880 * r, dur: 0.09, vol: 0.22 });
    tone({ from: 1760 * r, dur: 0.05, vol: 0.04, delay: 0.02, type: "triangle" });
  },
  // opening a dialog
  open() {
    tone({ from: 440, to: 660, dur: 0.1, vol: 0.18 });
    tone({ from: 660, to: 990, dur: 0.1, vol: 0.14, delay: 0.07 });
  },
  close() {
    tone({ from: 660, to: 440, dur: 0.1, vol: 0.16 });
  },
  flip() {
    tone({ from: 380, to: 900, dur: 0.11, type: "triangle", vol: 0.2 });
    tone({ from: 900, to: 1300, dur: 0.09, delay: 0.09, vol: 0.14 });
  },
  next() {
    tone({ from: 600, to: 900, dur: 0.08, vol: 0.2 });
  },
  prev() {
    tone({ from: 900, to: 600, dur: 0.08, vol: 0.2 });
  },
  shuffle() {
    for (let i = 0; i < 6; i++) {
      const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      tone({ from: note, dur: 0.07, vol: 0.12, delay: i * 0.05, type: "triangle" });
    }
  },
  // something was saved or created: a little rising chime
  success() {
    [523.25, 659.25, 783.99].forEach((note, i) => tone({ from: note, dur: 0.14, type: "triangle", vol: 0.18, delay: i * 0.08 }));
    tone({ from: 1046.5, dur: 0.2, vol: 0.1, delay: 0.26 });
  },
  // something was deleted: a soft falling bloop
  delete() {
    tone({ from: 520, to: 180, dur: 0.22, vol: 0.22 });
  },
  // validation problem: two gentle low boops
  oops() {
    tone({ from: 300, to: 260, dur: 0.1, type: "triangle", vol: 0.2 });
    tone({ from: 300, to: 260, dur: 0.1, type: "triangle", vol: 0.2, delay: 0.13 });
  },
  // the characters
  bunny() {
    tone({ from: 500, to: 900, dur: 0.16, vol: 0.2 });
    tone({ from: 900, to: 600, dur: 0.18, vol: 0.18, delay: 0.14 });
    tone({ from: 1400, to: 1800, dur: 0.06, vol: 0.05, delay: 0.05, type: "triangle" });
  },
  mochi() {
    tone({ from: 700, to: 1000, dur: 0.09, vol: 0.2 });
    tone({ from: 900, to: 1300, dur: 0.09, vol: 0.2, delay: 0.1 });
    tone({ from: 1900, dur: 0.12, vol: 0.06, delay: 0.2, type: "triangle" });
  },
};

function playSound(name) {
  if (!soundEnabled || !SOUNDS[name]) return;

  const now = performance.now();
  if (now - (lastPlayed[name] ?? 0) < MIN_GAP_MS) return;
  lastPlayed[name] = now;

  try {
    if (!getAudio()) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    SOUNDS[name]();
  } catch {
    // sound is only a nicety: never let it break the app
  }
}

/* ---------- Click wiring ---------- */

// These already play their own, more specific sound from app.js / friends.js
const OWN_SOUND = "#flip-card, #flashcard, #next-card, #prev-card, #shuffle, .friend-btn, #modal-confirm, #sound-toggle";
// These open a dialog
const OPENS_DIALOG = '#new-deck, #new-card, #edit-card, #delete-card, [data-action="edit"], [data-action="delete"], [data-action="edit-card"], [data-action="delete-card"], [data-empty-action="new-deck"], [data-empty-action="new-card"]';

// Capture phase, so it still runs if some other handler stops the event
document.addEventListener(
  "click",
  (event) => {
    const control = event.target.closest("button, a[href], [role='button']");
    if (!control || control.closest(OWN_SOUND)) return;

    if (control.matches(OPENS_DIALOG)) playSound("open");
    else if (control.id === "modal-cancel") playSound("close");
    else playSound("pop");
  },
  true
);

/* ---------- Sound on/off button ---------- */

const soundToggleBtn = document.getElementById("sound-toggle");

function renderSoundToggle() {
  soundToggleBtn.setAttribute("aria-pressed", String(soundEnabled));
  soundToggleBtn.querySelector(".sound-icon").textContent = soundEnabled ? "🔊" : "🔇";
}

soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  try {
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  } catch {
    // not saved, still works for this visit
  }
  renderSoundToggle();
  playSound("pop"); // silent when turning off
});

renderSoundToggle();
