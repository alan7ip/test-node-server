const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

let balance = 1000;

function render() {
  document.getElementById("balance").textContent = balance;
}

function coin() {
  const bet = 50;
  if (balance < bet) return alert("Недостаточно средств");
  balance -= bet;

  const win = Math.random() < 0.49; // честно: чуть меньше 50/50
  if (win) balance += bet * 2;

  render();
  alert(win ? `✅ Победа! +${bet}` : `❌ Проигрыш! -${bet}`);
}

function daily() {
  const key = "daily_claimed";
  const today = new Date().toDateString();
  if (localStorage.getItem(key) === today) return alert("Ежедневка уже забрана");

  const reward = 200;
  balance += reward;
  localStorage.setItem(key, today);
  render();
  alert(`🎁 Ежедневка: +${reward}`);
}

window.coin = coin;
window.daily = daily;

render();
