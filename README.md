# 👁️ SAHAY — Smart Assistive Hand Gesture and You

A browser-based sign language interpreter that uses your webcam and AI to detect hand gestures in real-time, convert them to text and speech, and translate spoken words into sign language gesture cards.

---

## ✨ Features

- 🖐️ **Real-time Gesture Detection** — Detects hand signs via webcam with text overlay directly on the camera feed
- 🎤 **Voice → Sign Translation** — Speak into your mic and see gesture cards for each word
- 🔤 **Spell & Build** — Spell words letter by letter using hand gestures (hold to confirm)
- ⚙️ **Custom Model Training** — Record your own gestures and train a personal ML model
- 🔐 **Login System** — Sign up / Sign in with secure password hashing
- 🔊 **Text to Speech** — Auto-speaks detected gestures aloud

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES Modules) |
| Hand AI | MediaPipe Tasks Vision (Google) |
| Backend | Python 3.13 + Flask |
| ML Model | RandomForest Classifier (scikit-learn) |
| Speech | Web Speech API |
| Auth | SHA-256 hashed passwords + Base64 tokens |

---

## 📁 Project Structure

```
Web tech project/
├── index.html          # Main app
├── login.html          # Login / Sign up page
├── style.css           # All styles
├── app.js              # Frontend logic + MediaPipe + Canvas overlay
├── app.py              # Flask backend server
├── requirement.txt     # Python dependencies
├── users.json          # Auto-created — stores user accounts
├── .venv/              # Python virtual environment
├── data/               # Training data (.npy files per gesture)
│   ├── A/
│   ├── B/
│   └── Hello/
└── model/
    └── gesture_model.pkl   # Trained ML model (auto-created)
```

---

## 🚀 How to Run

### Prerequisites
- Python 3.9 or higher
- Google Chrome or Safari
- Webcam + Microphone

### Step 1 — Set up Python environment

```bash
cd "Web tech project"
python3 -m venv .venv
source .venv/bin/activate
pip install flask flask-cors numpy scikit-learn
```

### Step 2 — Start the Backend (Terminal 1)

```bash
source .venv/bin/activate
python app.py
```

You should see:
```
🚀 Vision Backend starting on http://localhost:5050
```

### Step 3 — Start the Frontend Server (Terminal 2)

```bash
python3 -m http.server 8080
```

### Step 4 — Open in Browser

```
http://localhost:8080/login.html
```

> ⚠️ Always use `localhost` not `127.0.0.1` — microphone only works on `localhost`

---

## 🖐️ Built-in Gestures (No Training Needed)

These work immediately out of the box via MediaPipe:

| Gesture | Meaning |
|---------|---------|
| ✋ Open Palm | Hello |
| 👍 Thumb Up | Yes |
| 👎 Thumb Down | No |
| ✌️ Victory | Help |
| ☝️ Pointing Up | Please wait |
| ✊ Closed Fist | Stop |
| 🤟 I Love You | I love you |

---

## 🧠 Training Your Own Model

1. Go to **⚙️ Model & Data** tab
2. Type a label (e.g. `A`, `B`, `Hello`, `Stop`)
3. Click **● Record** — point your hand at the camera
4. Press **`S`** key to save each sample
5. Collect at least **50 samples per gesture** for good accuracy
6. Press **`N`** for next label
7. Click **🚀 Train Model** when done

Training takes just a few seconds. Accuracy % will be shown after training.

---

## 🔌 Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, returns token |
| GET | `/api/model/status` | Model + dataset info |
| POST | `/api/predict` | Predict gesture from 63 landmarks |
| POST | `/api/data/collect` | Save a training sample |
| GET | `/api/data/stats` | Dataset statistics |
| POST | `/api/train` | Train the ML model |

---

## 🔐 Authentication

- Passwords hashed with **SHA-256**
- Tokens stored in `localStorage` — valid for **7 days**
- **Demo mode** available — works even if backend is offline
- Sign Out button in the title bar

---

## 🎤 Voice Feature

- Uses browser's built-in **Web Speech API**
- Works best in **Chrome** and **Safari**
- Requires microphone permission

**To enable microphone:**
- Chrome: Click 🔒 in address bar → Site Settings → Microphone → Allow
- Safari: Safari menu → Settings → Websites → Microphone → Allow
- Mac: System Settings → Privacy & Security → Microphone → Allow your browser

---

## ❗ Troubleshooting

| Problem | Fix |
|---------|-----|
| `localhost:8080` not loading | Run `python3 -m http.server 8080` in terminal |
| Backend not connected | Run `python app.py` with venv activated |
| `No module named flask` | Run `pip install flask flask-cors numpy scikit-learn` |
| Camera not working | System Settings → Privacy → Camera → Allow browser |
| Microphone not working | Use `localhost` not `127.0.0.1` in URL |
| Login goes to demo mode | Start backend first, then login |
| Gestures not accurate | Collect more data (50+ samples) and retrain |
| Port already in use | Run `lsof -i :5050` then `kill -9 <PID>` |

---

## 👩‍💻 Developer

**Shiva Chaudhary**
Web Tech Project — 2026

---

## 📝 Notes

- The `data/` folder stores landmark files as `.npy` (numpy arrays) — no images stored
- Each gesture sample = 63 numbers (21 hand landmarks × X, Y, Z)
- The ML model uses **RandomForest with 200 trees**
- MediaPipe runs entirely in the browser — no video sent to server
- Only landmark coordinates (numbers) are sent to the backend for prediction
