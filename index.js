const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN; // токен зададим в Render Environment

// 1) ЛОГИ: чтобы видеть любые входящие запросы (очень важно)
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

// 2) Telegram присылает JSON -> обязательно
app.use(express.json());

// 3) Проверка, что сервер жив (открывай в браузере)
app.get("/", (req, res) => {
  res.status(200).send("OK. Server is running ✅");
});

// 4) Webhook endpoint (сюда будет стучаться Telegram)
app.post("/webhook", (req, res) => {
  // Telegram ждёт ответ 200 быстро, иначе будет ретраи
  res.sendStatus(200);

  // Покажем, что реально пришло
  console.log("WEBHOOK UPDATE:", JSON.stringify(req.body, null, 2));

  // Если хочешь, чтобы бот отвечал на сообщения:
  // (работает, когда пользователь пишет твоему боту обычный текст)
  try {
    if (!BOT_TOKEN) {
      console.log("BOT_TOKEN is missing in environment!");
      return;
    }

    const message = req.body?.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

    if (chatId && text) {
      // простейший ответ
      const replyText = `Ты написал: ${text}`;

      // Отправка сообщения через Telegram API
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      })
        .then((r) => r.json())
        .then((data) => console.log("sendMessage result:", data))
        .catch((err) => console.log("sendMessage error:", err));
    }
  } catch (e) {
    console.log("ERROR in webhook handler:", e);
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
