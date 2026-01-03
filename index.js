const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const users = {};

function getUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 100,
      lastDaily: 0
    };
  }
  return users[id];
}

app.post("/api/balance", (req, res) => {
  const u = getUser(req.body.userId);
  res.json({ balance: u.balance });
});

app.post("/api/coin", (req, res) => {
  const u = getUser(req.body.userId);
  const win = Math.random() < 0.5;
  if (win) u.balance += 10;
  else u.balance -= 10;
  res.json({ text: win ? "🎉 Победа +10" : "💀 Проигрыш -10" });
});

app.post("/api/daily", (req, res) => {
  const u = getUser(req.body.userId);
  const now = Date.now();
  if (now - u.lastDaily < 86400000) {
    return res.json({ text: "⏳ Уже получал сегодня" });
  }
  u.lastDaily = now;
  u.balance += 50;
  res.json({ text: "🎁 +50 за ежедневку" });
});

app.post("/api/work", (req, res) => {
  const u = getUser(req.body.userId);
  const earn = 5 + Math.floor(Math.random() * 15);
  u.balance += earn;
  res.json({ text: `💼 Работа: +${earn}` });
});

app.post(`/webhook/${process.env.WEBHOOK_SECRET}`, (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🎮 Добро пожаловать!",
        reply_markup: {
          keyboard: [[{ text: "🎮 Открыть Mini App" }]],
          resize_keyboard: true
        }
      })
    });
  }

  res.sendStatus(200);
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started", PORT));
