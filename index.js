const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Проверка, что сервер жив
app.get("/", (req, res) => {
  res.send("Telegram bot server is running 🚀");
});

// Webhook от Telegram
app.post(`/webhook`, (req, res) => {
  const update = req.body;

  console.log("Update from Telegram:", JSON.stringify(update, null, 2));

  res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
