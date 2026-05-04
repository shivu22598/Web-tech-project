/**
 * SAHAY — Smart Assistive Hand Gesture and You
 * app.js  (ES Module)
 *
 * Sections:
 *   1. Imports & Constants
 *   2. Utility (toast, badge)
 *   3. Tab Navigation
 *   4. Backend Health Check
 *   5. MediaPipe Setup
 *   6. Gesture Detection Tab
 *   7. Voice → Sign Tab
 *   8. Spell & Build Tab
 *   9. Model & Data Tab
 */

// ═══════════════════════════════════════════════════════════════
// 1. IMPORTS & CONSTANTS
// ═══════════════════════════════════════════════════════════════

import {
  GestureRecognizer,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const BACKEND = "http://127.0.0.1:5050";

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

// ═══════════════════════════════════════════════════════════════
// 2. UTILITY
// ═══════════════════════════════════════════════════════════════

/**
 * Show a temporary toast notification.
 * @param {string} msg   - Message text
 * @param {'info'|'success'|'error'|'warn'} type
 */
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  const icons = { info: "ℹ️", success: "✅", error: "❌", warn: "⚠️" };
  el.textContent = `${icons[type] || ""} ${msg}`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

/**
 * Toggle the .active class on a status badge.
 * @param {string}  id     - Element ID
 * @param {boolean} active
 */
function setBadge(id, active) {
  document.getElementById(id)?.classList.toggle("active", active);
}

// ═══════════════════════════════════════════════════════════════
// 3. TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. BACKEND HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

async function checkBackend() {
  try {
    const res  = await fetch(`${BACKEND}/api/model/status`);
    const data = await res.json();
    setBadge("backendBadge", true);
    setBadge("modelBadge", data.model_loaded);
    if (data.model_loaded) {
      document.getElementById("statAcc").textContent     = data.accuracy || "—";
      document.getElementById("statClasses").textContent = data.classes?.length || "—";
    }
    return data;
  } catch {
    setBadge("backendBadge", false);
    return null;
  }
}

checkBackend();

// ═══════════════════════════════════════════════════════════════
// 5. MEDIAPIPE SETUP
// ═══════════════════════════════════════════════════════════════

let gestureRecognizer = null;
let spellerRecognizer = null;

/** Create a new GestureRecognizer instance from MediaPipe. */
async function createRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL },
    runningMode: "VIDEO",
    numHands: 1
  });
}

/**
 * Flatten MediaPipe hand landmarks into a 63-value array [x,y,z × 21].
 * @param {Object} results - MediaPipe recognizer results
 * @returns {number[]|null}
 */
function extractLandmarks(results) {
  if (!results.landmarks || results.landmarks.length === 0) return null;
  const arr = [];
  results.landmarks[0].forEach((lm) => arr.push(lm.x, lm.y, lm.z));
  return arr;
}

// ═══════════════════════════════════════════════════════════════
// 6. GESTURE DETECTION TAB
// ═══════════════════════════════════════════════════════════════

// -- DOM refs --
const video        = document.getElementById("video");
const camOverlay   = document.getElementById("camOverlay");
const liveDot      = document.getElementById("liveDot");
const gestureStatus = document.getElementById("gestureStatus");
const gestureText  = document.getElementById("gestureText");
const gestureWord  = document.getElementById("gestureWord");
const confFill     = document.getElementById("confFill");
const confPct      = document.getElementById("confPct");
const spokenText   = document.getElementById("spokenText");
const top3Chips    = document.getElementById("top3Chips");

// -- State --
let stream1       = null;
let animId1       = null;
let lastVideoTime1 = -1;
let lastSpoken    = "";
let history = [];
let lastSpokenTime = 0;

// MediaPipe built-in gesture → readable English mapping
const gestureMeaningMap = {
  Open_Palm:    "Hello",
  Thumb_Up:     "Yes",
  Thumb_Down:   "No",
  Victory:      "Help",
  Pointing_Up:  "Please wait",
  Closed_Fist:  "Stop",
  ILoveYou:     "I love you"
};

/** Speak a text string using the Web Speech API. */
function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u  = new SpeechSynthesisUtterance(text);
  u.lang   = "en-US";
  window.speechSynthesis.speak(u);
}

/** Start the webcam and begin the gesture recognition loop. */
async function startCamera() {
  try {
    stream1 = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });
    video.srcObject = stream1;
    await video.play();

    camOverlay.classList.add("hidden");
    liveDot.classList.add("active");
    gestureStatus.textContent = "Live";
    setBadge("camBadge", true);

    if (!gestureRecognizer) gestureRecognizer = await createRecognizer();
    predictLoop();
  } catch (e) {
    toast("Camera access denied or unavailable", "error");
    gestureStatus.textContent = "Error";
  }
}

/** Stop the webcam stream and recognition loop. */
function stopCamera() {
  cancelAnimationFrame(animId1);
  stream1?.getTracks().forEach((t) => t.stop());
  stream1 = null;
  video.srcObject = null;

  camOverlay.classList.remove("hidden");
  liveDot.classList.remove("active");
  gestureStatus.textContent = "Offline";
  setBadge("camBadge", false);
}

/** Main rAF loop — runs gesture recognition on each video frame. */
async function predictLoop() {
  if (!gestureRecognizer || !video.srcObject) {
    animId1 = requestAnimationFrame(predictLoop);
    return;
  }

  const now = performance.now();

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime1) {
    lastVideoTime1 = video.currentTime;
    const results  = gestureRecognizer.recognizeForVideo(video, now);
    const lms      = extractLandmarks(results);

    if (results.gestures?.length > 0 && results.gestures[0].length > 0) {
      const top        = results.gestures[0][0];
      const label      = top.categoryName;
      const score      = top.score;
      const translated = gestureMeaningMap[label] || label.replace(/_/g, " ");
      history.push(translated);
      if (history.length > 5) history.shift();

      const stableGesture = mostCommon(history);

      // Update UI
      gestureText.textContent = label.charAt(0);
      gestureWord.textContent = stableGesture;
      confFill.style.width    = `${(score * 100).toFixed(0)}%`;
      confPct.textContent     = `${(score * 100).toFixed(0)}%`;

      // Top-3 chips
      top3Chips.innerHTML = results.gestures[0]
        .slice(0, 3)
        .map((g, i) =>
          `<div class="pred-chip ${i === 0 ? "first" : ""}">
            <strong>${g.categoryName.charAt(0)}</strong>
            ${g.categoryName.replace(/_/g, " ")} — ${(g.score * 100).toFixed(0)}%
          </div>`
        )
        .join("");

      // Auto-speak with 2-second cooldown
      if (
        translated !== lastSpoken &&
        score > 0.65 &&
        Date.now() - lastSpokenTime > 2000
      ) {
        lastSpoken     = translated;
        lastSpokenTime = Date.now();
        spokenText.textContent = `🔊 ${translated}`;
        speakText(translated);
      }

      // Optionally enrich with backend ML prediction
      if (lms && score > 0.5) {
        try {
          const r = await fetch(`${BACKEND}/api/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ landmarks: lms })
          });
          if (r.ok) {
            const d = await r.json();
            if (d.success) {
              gestureWord.textContent = d.top_prediction;
              confFill.style.width = `${d.confidence}%`;
              confPct.textContent = `${d.confidence}%`;
            }
          }
        } catch { /* backend offline — silent fail */ }
      }

    } else {
      gestureText.textContent = "—";
      gestureWord.textContent = "No gesture detected";
      confFill.style.width    = "0%";
      confPct.textContent     = "0%";
      top3Chips.innerHTML     = "";
    }
  }

  animId1 = requestAnimationFrame(predictLoop);
}

// -- Button listeners --
document.getElementById("startCamBtn").addEventListener("click", startCamera);
document.getElementById("stopCamBtn").addEventListener("click", stopCamera);

document.getElementById("speakAgainBtn").addEventListener("click", () => {
  speakText(lastSpoken);
});

document.getElementById("clearDetectBtn").addEventListener("click", () => {
  gestureText.textContent = "—";
  gestureWord.textContent = "Waiting...";
  spokenText.textContent  = "Nothing spoken yet";
  confFill.style.width    = "0%";
  confPct.textContent     = "0%";
  top3Chips.innerHTML     = "";
  lastSpoken              = "";
});

// ═══════════════════════════════════════════════════════════════
// 7. VOICE → SIGN TAB
// ═══════════════════════════════════════════════════════════════

// -- DOM refs --
const voiceTextEl    = document.getElementById("voiceText");
const voiceStatusEl  = document.getElementById("voiceStatus");
const voiceIconEl    = document.getElementById("voiceStatusIcon");
const gestureOutputEl = document.getElementById("gestureOutput");
const waveBars       = [1, 2, 3, 4, 5].map((i) => document.getElementById(`wb${i}`));

// Word → gesture card dictionary
const gestureDictionary = {
  hello:     "👋 HELLO",
  hi:        "👋 HI",
  yes:       "👍 YES",
  no:        "✋ NO",
  thanks:    "🙏 THANKS",
  thank:     "🙏 THANK",
  help:      "🆘 HELP",
  water:     "💧 WATER",
  food:      "🍽 FOOD",
  stop:      "🛑 STOP",
  ok:        "👌 OK",
  i:         "👉 I",
  you:       "👉 YOU",
  love:      "❤️ LOVE",
  please:    "🤲 PLEASE",
  wait:      "⏳ WAIT",
  emergency: "🚨 EMERGENCY",
  good:      "👍 GOOD",
  bad:       "👎 BAD",
  bye:       "👋 BYE"
};

/**
 * Convert a text string into gesture card elements.
 * @param {string} text
 */
function textToGestureCards(text) {
  gestureOutputEl.innerHTML = "";
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (!cleaned) {
    gestureOutputEl.innerHTML = '<div class="empty-msg">No gesture translation yet…</div>';
    return;
  }
  cleaned.split(/\s+/).forEach((word, i) => {
    const label = gestureDictionary[word] || `❓ ${word.toUpperCase()}`;
    const card  = document.createElement("div");
    card.className            = "gesture-card";
    card.textContent          = label;
    card.style.animationDelay = `${i * 0.06}s`;
    gestureOutputEl.appendChild(card);
  });
}

/** Update voice status icon + text and toggle waveform animation. */
function setVoiceStatus(mode, text) {
  const icons = { idle: "⚪", listening: "🔴", stopped: "🚫", error: "⚠️" };
  voiceIconEl.textContent = icons[mode] || "⚪";
  voiceStatusEl.textContent = `Status: ${text}`;
  waveBars.forEach((b) => b.classList.toggle("active", mode === "listening"));
}

let recognition;

/** Build and return a SpeechRecognition instance. */
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setVoiceStatus("error", "Not supported in this browser");
    return null;
  }
  const r          = new SR();
  r.lang           = "en-US";
  r.continuous     = true;
  r.interimResults = true;

  r.onstart = () => setVoiceStatus("listening", "Listening...");

  r.onresult = (e) => {
    let t = "";
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
    voiceTextEl.value = t.trim();
    textToGestureCards(t.trim());
  };

  r.onerror = (e) => setVoiceStatus("error", e.error);
  r.onend   = ()  => setVoiceStatus("stopped", "Stopped");
  return r;
}

// -- Button listeners --
document.getElementById("startVoiceBtn").addEventListener("click", () => {
  if (!recognition) recognition = setupSpeechRecognition();
  recognition?.start();
});

document.getElementById("stopVoiceBtn").addEventListener("click", () => {
  recognition?.stop();
  setVoiceStatus("stopped", "Stopped");
});

document.getElementById("clearVoiceBtn").addEventListener("click", () => {
  voiceTextEl.value = "";
  textToGestureCards("");
  recognition?.stop();
  setVoiceStatus("idle", "Idle");
});

document.getElementById("translateManualBtn").addEventListener("click", () => {
  const v = document.getElementById("manualInput").value;
  if (v) textToGestureCards(v);
});

// ═══════════════════════════════════════════════════════════════
// 8. SPELL & BUILD TAB
// ═══════════════════════════════════════════════════════════════

// -- DOM refs --
const video2         = document.getElementById("video2");
const camOverlay2    = document.getElementById("camOverlay2");
const liveDot2       = document.getElementById("liveDot2");
const spellerStatusEl = document.getElementById("spellerStatus");
const spellLetterEl  = document.getElementById("spellLetter");
const spellWordEl    = document.getElementById("spellWord");
const letterStripEl  = document.getElementById("letterStrip");
const builtWordEl    = document.getElementById("builtWord");

// -- State --
let stream2        = null;
let animId2        = null;
let lastVideoTime2 = -1;
let spelledLetters = [];
let holdLetter     = "";
let holdStart      = 0;
let holdCommitted  = false;

const HOLD_MS = 1200; // milliseconds to hold a gesture before confirming

/** Start the speller camera. */
async function startSpeller() {
  try {
    stream2 = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });
    video2.srcObject = stream2;
    await video2.play();

    camOverlay2.classList.add("hidden");
    liveDot2.classList.add("active");
    spellerStatusEl.textContent = "Live";

    if (!spellerRecognizer) spellerRecognizer = await createRecognizer();
    spellerLoop();
  } catch {
    toast("Camera error", "error");
  }
}

/** Stop the speller camera. */
function stopSpeller() {
  cancelAnimationFrame(animId2);
  stream2?.getTracks().forEach((t) => t.stop());
  stream2  = null;
  video2.srcObject = null;

  camOverlay2.classList.remove("hidden");
  liveDot2.classList.remove("active");
  spellerStatusEl.textContent = "Offline";
}

/** Re-render the letter strip and built-word display. */
function renderLetterStrip() {
  if (!spelledLetters.length) {
    letterStripEl.innerHTML  = '<span class="empty-msg">Letters will appear here…</span>';
    builtWordEl.textContent  = "—";
    return;
  }
  letterStripEl.innerHTML = spelledLetters
    .map((l) => `<div class="letter-chip">${l}</div>`)
    .join("");
  builtWordEl.textContent = spelledLetters.join("");
}

/** Speller rAF loop — hold-to-confirm letter selection. */
async function spellerLoop() {
  if (!spellerRecognizer || !video2.srcObject) {
    animId2 = requestAnimationFrame(spellerLoop);
    return;
  }

  const now = performance.now();

  if (video2.readyState >= 2 && video2.currentTime !== lastVideoTime2) {
    lastVideoTime2 = video2.currentTime;
    const results  = spellerRecognizer.recognizeForVideo(video2, now);
    const lms      = extractLandmarks(results);

    if (results.gestures?.length > 0) {
      const top   = results.gestures[0][0];
      const label = top.categoryName;
      let finalLabel = label.charAt(0).toUpperCase();

      spellLetterEl.textContent = finalLabel;

      // Prefer backend ML prediction if available
      if (lms) {
        try {
          const r = await fetch(`${BACKEND}/api/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ landmarks: lms })
          });
          if (r.ok) {
            const d = await r.json();
            if (d.success) {
              finalLabel                = d.top_prediction;
              spellLetterEl.textContent = finalLabel;
            }
          }
        } catch { /* silent fail */ }
      }

      // Hold-to-confirm
      if (finalLabel === holdLetter) {
        const elapsed = Date.now() - holdStart;
        const pct     = Math.min(100, (elapsed / HOLD_MS) * 100);
        spellWordEl.textContent = `Hold ${Math.round(pct)}% — ${
          HOLD_MS - elapsed > 0
            ? ((HOLD_MS - elapsed) / 1000).toFixed(1) + "s"
            : "✓"
        }`;

        if (elapsed >= HOLD_MS && !holdCommitted) {
          holdCommitted = true;
          spelledLetters.push(finalLabel);
          renderLetterStrip();
          toast(`Added: ${finalLabel}`, "success");
        }
      } else {
        holdLetter    = finalLabel;
        holdStart     = Date.now();
        holdCommitted = false;
        spellWordEl.textContent = "Hold to confirm...";
      }

    } else {
      spellLetterEl.textContent = "—";
      spellWordEl.textContent   = "Show hand clearly";
      holdLetter                = "";
    }
  }

  animId2 = requestAnimationFrame(spellerLoop);
}

// -- Button listeners --
document.getElementById("startSpellBtn").addEventListener("click", startSpeller);
document.getElementById("stopSpellBtn").addEventListener("click", stopSpeller);

document.getElementById("clearSpellBtn").addEventListener("click", () => {
  spelledLetters = [];
  renderLetterStrip();
  holdLetter = "";
});

document.getElementById("backspaceBtn").addEventListener("click", () => {
  spelledLetters.pop();
  renderLetterStrip();
});

document.getElementById("speakWordBtn").addEventListener("click", () => {
  const w = builtWordEl.textContent;
  if (w && w !== "—") speakText(w);
});

// ═══════════════════════════════════════════════════════════════
// 9. MODEL & DATA TAB
// ═══════════════════════════════════════════════════════════════

/** Fetch and render the dataset statistics from the backend. */
async function loadDataStats() {
  try {
    const r    = await fetch(`${BACKEND}/api/data/stats`);
    const data = await r.json();
    const list = document.getElementById("dataList");

    if (!Object.keys(data.stats).length) {
      list.innerHTML = '<span class="empty-msg">No data collected yet</span>';
      return;
    }

    list.innerHTML = Object.entries(data.stats)
      .map(
        ([lbl, cnt]) =>
          `<div class="data-item">
            <span class="lbl">${lbl}</span>
            <span class="cnt">${cnt} samples</span>
          </div>`
      )
      .join("");

    document.getElementById("statSamples").textContent = data.total;
  } catch {
    document.getElementById("dataList").innerHTML =
      '<span class="empty-msg" style="color:var(--danger)">Backend not connected</span>';
  }
}

/** Send a training request to the backend and update the UI. */
async function trainModel() {
  const btn      = document.getElementById("trainBtn");
  const progress = document.getElementById("trainProgress");
  const status   = document.getElementById("trainStatus");

  btn.disabled = true;
  progress.classList.add("show");
  status.innerHTML = "<span class='sicon'>⏳</span><span>Training model…</span>";

  try {
    const r    = await fetch(`${BACKEND}/api/train`, { method: "POST" });
    const data = await r.json();

    if (data.success) {
      document.getElementById("statAcc").textContent     = data.accuracy;
      document.getElementById("statSamples").textContent = data.total_samples;
      document.getElementById("statClasses").textContent = data.classes.length;
      setBadge("modelBadge", true);
      toast(`Training complete! Accuracy: ${data.accuracy}%`, "success");
      status.innerHTML = `<span class="sicon">✅</span>
        <span>Accuracy: ${data.accuracy}% — ${data.total_samples} samples, ${data.classes.length} classes</span>`;
    } else {
      toast(data.error, "error");
      status.innerHTML = `<span class="sicon">❌</span><span>${data.error}</span>`;
    }
  } catch {
    toast("Backend not reachable", "error");
    status.innerHTML =
      "<span class='sicon'>❌</span><span>Backend not reachable. Run: python backend/app.py</span>";
  }

  btn.disabled = false;
  progress.classList.remove("show");
}

// -- Button listeners --
document.getElementById("trainBtn").addEventListener("click", trainModel);

document.getElementById("refreshStatusBtn").addEventListener("click", async () => {
  const data   = await checkBackend();
  await loadDataStats();

  if (data) {
    const status = document.getElementById("trainStatus");
    status.innerHTML = data.model_loaded
      ? `<span class="sicon">✅</span><span>Model loaded — ${data.classes?.length || 0} classes</span>`
      : `<span class="sicon">⚠️</span><span>No trained model found — collect data and train</span>`;

    if (data.data_info?.total_samples) {
      document.getElementById("statSamples").textContent = data.data_info.total_samples;
      document.getElementById("statClasses").textContent = data.data_info.classes?.length || "—";
    }
  }
});

// Initial load
loadDataStats();
function mostCommon(arr) {
  return arr.sort((a,b) =>
    arr.filter(v => v===a).length - arr.filter(v => v===b).length
  ).pop();
}