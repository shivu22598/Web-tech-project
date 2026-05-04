from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import os
import pickle

app = Flask(__name__)
CORS(app)

MODEL_PATH = "model.pkl"

model = None
labels = None

# Load model if exists
if os.path.exists(MODEL_PATH):
    with open(MODEL_PATH, "rb") as f:
        model, labels = pickle.load(f)


@app.route("/api/model/status")
def status():
    return jsonify({
        "model_loaded": model is not None,
        "classes": labels if labels else []
    })


@app.route("/api/train", methods=["GET", "POST"])
def predict():
    global model, labels

    if model is None or labels is None:
        return jsonify({"success": False, "error": "Model not trained"}), 400

    data = request.get_json()
    landmarks = data.get("landmarks")

    if len(landmarks) != 63:
        return jsonify({"success": False, "error": "Invalid input"}), 400

    import numpy as np
    X = np.array(landmarks).reshape(1, -1)

    pred = model.predict(X)[0]
    prob = max(model.predict_proba(X)[0])

    return jsonify({
        "success": True,
        "top_prediction": labels[pred],
        "confidence": round(prob * 100, 2)
    })


@app.route("/api/train", methods=["POST"])
def train():
    from sklearn.ensemble import RandomForestClassifier

    X = []
    y = []

    # Load dataset
    for label in os.listdir("data"):
        folder = os.path.join("data", label)
        for file in os.listdir(folder):
            arr = np.load(os.path.join(folder, file))
            X.append(arr)
            y.append(label)

    X = np.array(X)

    unique_labels = list(set(y))
    label_map = {l: i for i, l in enumerate(unique_labels)}
    y_encoded = np.array([label_map[i] for i in y])

    clf = RandomForestClassifier(n_estimators=200)
    clf.fit(X, y_encoded)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump((clf, unique_labels), f)

    return jsonify({"success": True, "message": "Model trained!"})


@app.route("/api/data", methods=["POST"])
def collect():
    data = request.get_json()
    label = data.get("label")
    landmarks = data.get("landmarks")

    folder = f"data/{label}"
    os.makedirs(folder, exist_ok=True)

    file = f"{folder}/{len(os.listdir(folder))}.npy"
    np.save(file, np.array(landmarks))

    return jsonify({"success": True})


if __name__ == "__main__":
   app.run(port=5050, debug=True, use_reloader=False)