const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(bodyParser.json());

const USERS_FILE = './users.json';
const SECRET = 'supersecretkey';

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ message: 'User exists' });
  const newUser = { username, password, balance: 1000, isAdmin: false };
  users.push(newUser);
  saveUsers(users);
  res.json({ message: 'Registered successfully' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(403).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ username, isAdmin: user.isAdmin }, SECRET);
  res.json({ token, balance: user.balance, isAdmin: user.isAdmin });
});

app.post('/api/dice', authenticateToken, (req, res) => {
  const { bet } = req.body;
  let users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user || user.balance < bet) return res.status(400).json({ message: 'Insufficient balance' });

  const roll = Math.floor(Math.random() * 6) + 1;
  const win = roll > 3;
  user.balance += win ? bet : -bet;

  saveUsers(users);
  res.json({ message: `Rolled a ${roll}. ${win ? 'You won!' : 'You lost.'}`, balance: user.balance });
});

app.post('/api/slot', authenticateToken, (req, res) => {
  const { bet } = req.body;
  let users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user || user.balance < bet) return res.status(400).json({ message: 'Insufficient balance' });

  const symbols = ['🍒', '🍋', '7️⃣', '🔔'];
  const spin = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
  const win = spin[0] === spin[1] && spin[1] === spin[2];
  user.balance += win ? bet * 5 : -bet;

  saveUsers(users);
  res.json({ result: spin, message: win ? 'Jackpot!' : 'Try again!', balance: user.balance });
});

app.post('/api/blackjack', authenticateToken, (req, res) => {
  const { bet } = req.body;
  let users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user || user.balance < bet) return res.status(400).json({ message: 'Insufficient balance' });

  const draw = () => Math.floor(Math.random() * 11) + 1;
  const player = draw() + draw();
  const dealer = draw() + draw();
  const win = player <= 21 && (player > dealer || dealer > 21);
  user.balance += win ? bet : -bet;

  saveUsers(users);
  res.json({ message: `You: ${player}, Dealer: ${dealer}. ${win ? 'You win!' : 'You lose!'}`, balance: user.balance });
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const users = loadUsers();
  res.json(users);
});

app.post('/api/admin/setbalance', authenticateToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  const { username, balance } = req.body;
  let users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.balance = balance;
  saveUsers(users);
  res.json({ message: 'Balance updated' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
