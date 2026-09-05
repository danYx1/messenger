let socket = null;
let myNick = null;
let onlineCount = 0;

const $ = (id) => document.getElementById(id);

// Набор смайликов как в популярных мессенджерах
const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","😉","😊","😇","🥰","😍","🤩","😘",
  "😋","😜","🤪","😎","🥳","😏","😒","😞","😔","😢","😭","😤","😠","😡","🤯","🥺",
  "🥱","😴","🤤","😷","🤒","🤕","🤢","🥴","😵","🤠","🤑","🤫","🤔","🤐","🤨","😐",
  "😑","😬","🙄","😮","😲","😱","👍","👎","👌","✌️","🤞","🤟","🤘","👏","🙌","🙏",
  "💪","🤝","👋","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💞","💓",
  "💗","💖","💘","💝","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
  "🐷","🐸","🐵","🐔","🦄","🐝","🦋","🌸","🌺","🌈","☀️","⭐","🔥","💧","🍏","🍎",
  "🍕","🍔","🍟","🌮","🍩","🍰","🍫","🍿","☕","🍺","🎂","⚽","🏀","🎮","🎧","🎁",
  "🎉","🎈","✈️","🚗","💡","📱","💻","💰","🏆","🚀","💯","✨"
];

window.addEventListener("DOMContentLoaded", () => {
  // Авто-подстановка адреса сервера
  const saved = localStorage.getItem("server");
  $("server").value = saved || detectServer();
  $("nick").value = localStorage.getItem("nick") || "";

  buildEmojiPanel();

  $("joinBtn").addEventListener("click", join);
  $("sendBtn").addEventListener("click", send);
  $("leaveBtn").addEventListener("click", leave);
  $("emojiBtn").addEventListener("click", toggleEmoji);
  $("photoBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", onPhotoSelected);

  $("text").addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
  $("nick").addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });
  // Клик по полю ввода прячет панель смайликов
  $("text").addEventListener("focus", () => $("emoji-panel").classList.add("hidden"));
});

// Если страница открыта с самого сервера (в браузере) — берём его адрес.
// Внутри iOS-приложения origin "capacitor://localhost" — его пропускаем.
function detectServer() {
  const origin = window.location.origin;
  if (/^https?:\/\//.test(origin) && origin !== "https://localhost") {
    return origin;
  }
  return "";
}

function join() {
  let server = $("server").value.trim().replace(/\/+$/, "");
  const nick = $("nick").value.trim();
  const errorEl = $("login-error");

  if (!server) server = detectServer(); // пусто = тот же сервер, что отдал страницу
  if (!server) {
    errorEl.textContent = "Укажи адрес сервера, например http://192.168.1.40:5000";
    return;
  }
  if (!nick) {
    errorEl.textContent = "Укажи ник";
    return;
  }

  errorEl.textContent = "";
  $("joinBtn").textContent = "Подключение…";

  try {
    socket = io(server, { transports: ["websocket", "polling"] });
  } catch (e) {
    errorEl.textContent = "Ошибка: " + e.message;
    $("joinBtn").textContent = "Войти в чат";
    return;
  }

  socket.on("connect", () => {
    myNick = nick;
    localStorage.setItem("server", server);
    localStorage.setItem("nick", nick);
    socket.emit("join", { username: nick });
    $("login-screen").classList.add("hidden");
    $("chat-screen").classList.remove("hidden");
    $("joinBtn").textContent = "Войти в чат";
    setStatus(true);
  });

  socket.on("connect_error", () => {
    setStatus(false);
    if (!$("chat-screen").classList.contains("hidden")) return;
    errorEl.textContent = "Не удалось подключиться. Проверь адрес и что сервер запущен.";
    $("joinBtn").textContent = "Войти в чат";
  });

  socket.on("disconnect", () => setStatus(false));

  socket.on("online", (n) => {
    onlineCount = n;
    setStatus(socket.connected);
  });

  socket.on("history", (messages) => {
    $("messages").innerHTML = "";
    messages.forEach(addMessage);
  });

  socket.on("message", addMessage);
}

function leave() {
  if (socket) socket.disconnect();
  socket = null;
  $("chat-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
}

function setStatus(online) {
  const el = $("status");
  if (online) {
    el.textContent = onlineCount > 0 ? onlineCount + " в сети" : "в сети";
    el.className = "status online";
  } else {
    el.textContent = "нет соединения";
    el.className = "status offline";
  }
}

/* ---------- Отправка сообщений ---------- */

function send() {
  const input = $("text");
  const text = input.value.trim();
  if (!text || !socket || !socket.connected) return;
  socket.emit("message", { username: myNick, text });
  input.value = "";
  $("emoji-panel").classList.add("hidden");
  input.focus();
}

/* ---------- Фото ---------- */

function onPhotoSelected(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !socket || !socket.connected) return;

  compressImage(file, (dataUrl) => {
    const text = $("text").value.trim(); // подпись к фото, если набрана
    socket.emit("message", { username: myNick, text, image: dataUrl });
    $("text").value = "";
  });
}

// Сжимаем фото до 1280px и JPEG — чтобы быстро летало по сети
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      let w = img.width, h = img.height;
      if (Math.max(w, h) > MAX) {
        const k = MAX / Math.max(w, h);
        w = Math.round(w * k);
        h = Math.round(h * k);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Смайлики ---------- */

function buildEmojiPanel() {
  const panel = $("emoji-panel");
  EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      const input = $("text");
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
      input.focus();
      input.selectionStart = input.selectionEnd = start + emoji.length;
    });
    panel.appendChild(btn);
  });
}

function toggleEmoji() {
  $("emoji-panel").classList.toggle("hidden");
}

/* ---------- Отрисовка сообщений ---------- */

// Цвет аватара зависит от ника — у каждого свой
function avatarStyle(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h}, 70%, 52%), hsl(${(h + 45) % 360}, 70%, 42%))`;
}

function addMessage(msg) {
  const box = $("messages");

  if (msg.type === "system") {
    const div = document.createElement("div");
    div.className = "msg system";
    div.textContent = msg.text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return;
  }

  const own = msg.username === myNick;
  const row = document.createElement("div");
  row.className = "msg-row " + (own ? "own" : "other");

  if (!own) {
    const av = document.createElement("div");
    av.className = "avatar";
    av.style.background = avatarStyle(msg.username);
    av.textContent = (msg.username[0] || "?").toUpperCase();
    row.appendChild(av);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = (own ? "" : msg.username + " · ") + msg.time;
  bubble.appendChild(meta);

  if (msg.image) {
    const img = document.createElement("img");
    img.className = "msg-img";
    img.src = msg.image;
    img.alt = "фото";
    bubble.appendChild(img);
  }

  if (msg.text) {
    bubble.appendChild(document.createTextNode(msg.text));
  }

  row.appendChild(bubble);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}
