const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Проверка, что сервер жив
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// Webhook от Telegram
app.post("/webhook", async (req, res) => {
  console.log("UPDATE FROM TELEGRAM:");
  console.log(JSON.stringify(req.body, null, 2));

  const message = req.body.message;

  if (message && message.text === "/start") {
    const chatId = message.chat.id;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Бот подключён и работает через webhook!",
      }),
    });
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
