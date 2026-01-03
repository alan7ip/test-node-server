const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || "test";

const log = (text) => {
  document.getElementById("log").innerText = text;
};

async function api(action) {
  const res = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });
  return res.json();
}

async function updateBalance() {
  const data = await api("balance");
  document.getElementById("balance").innerText =
    "Баланс: " + data.balance;
}

async function playCoin() {
  const data = await api("coin");
  log(data.text);
  updateBalance();
}

async function daily() {
  const data = await api("daily");
  log(data.text);
  updateBalance();
}

async function work() {
  const data = await api("work");
  log(data.text);
  updateBalance();
}

updateBalance();
