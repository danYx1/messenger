import os
from datetime import datetime

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
MAX_HISTORY = 100

app = Flask(__name__, static_folder=WEB_DIR, static_url_path="")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading",
                    max_http_buffer_size=20 * 1024 * 1024)  # фото до ~15 МБ

history = []
online = 0


def now():
    return datetime.now().strftime("%H:%M")


def add_to_history(msg):
    history.append(msg)
    del history[:-MAX_HISTORY]


@app.route("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@socketio.on("connect")
def on_connect():
    global online
    online += 1
    emit("online", online, broadcast=True)
    # Новому клиенту сразу отправляем историю чата
    emit("history", history)


@socketio.on("disconnect")
def on_disconnect():
    global online
    online = max(0, online - 1)
    emit("online", online, broadcast=True)


@socketio.on("join")
def on_join(data):
    username = str((data or {}).get("username", "Аноним"))[:20].strip() or "Аноним"
    msg = {"type": "system", "text": f"{username} присоединился к чату", "time": now()}
    add_to_history(msg)
    emit("message", msg, broadcast=True)


@socketio.on("message")
def on_message(data):
    data = data or {}
    username = str(data.get("username", "Аноним"))[:20].strip() or "Аноним"
    text = str(data.get("text", ""))[:500].strip()

    # Фото приходит как data URL (base64), уже сжатое на клиенте
    image = data.get("image")
    if image:
        image = str(image)
        if not image.startswith("data:image/") or len(image) > 4_000_000:
            image = None

    if not text and not image:
        return

    msg = {"type": "chat", "username": username, "text": text, "time": now()}
    if image:
        msg["image"] = image
    add_to_history(msg)
    emit("message", msg, broadcast=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Сервер запущен: http://localhost:{port}")
    socketio.run(app, host="0.0.0.0", port=port)
