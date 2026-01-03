const express = require("express");

const app = express();
app.use(express.json()); // ВАЖНО

const PORT = process.env.PORT || 3000;

// Проверка что сервер жив
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// Webhook endpoint для Telegram
app.post("/webhook", (req, res) => {
  console.log("Update from Telegram:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
