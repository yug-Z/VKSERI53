const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const speedLabel = document.getElementById('speedLabel');
const distanceLabel = document.getElementById('distanceLabel');
const moodLabel = document.getElementById('moodLabel');
const moodSelect = document.getElementById('moodSelect');
const commentInput = document.getElementById('commentInput');
const saveMoodBtn = document.getElementById('saveMoodBtn');
const logList = document.getElementById('logList');
const chart = document.getElementById('chart');

const world = {
  horizonY: canvas.height * 0.42,
  tileSize: 34,
  rows: 7,
  cols: 28,
  offsetX: 0,
  baseSpeed: 0,
  distance: 0,
};

const thar = {
  x: canvas.width * 0.48,
  y: canvas.height * 0.66,
  width: 78,
  height: 44,
  velocity: 0,
  maxSpeed: 10,
  steer: 0,
};

const keys = new Set();
const sentimentHistory = JSON.parse(localStorage.getItem('thar-sentiment-history') || '[]');

const moodScores = {
  excited: 95,
  happy: 80,
  neutral: 55,
  frustrated: 30,
  angry: 10,
};

const keywordBoost = {
  awesome: 8,
  great: 6,
  smooth: 5,
  fun: 6,
  love: 8,
  lag: -8,
  boring: -8,
  bad: -6,
  stuck: -7,
  rough: -5,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildHeightMap() {
  return Array.from({ length: world.rows }, (_, row) => {
    return Array.from({ length: world.cols }, (_, col) => {
      const seed = (row * 17 + col * 13) % 9;
      const h = 14 + seed * 3;
      return h;
    });
  });
}

const heightMap = buildHeightMap();

function drawBlock(x, y, size, height) {
  const topColor = `hsl(36, 45%, ${54 - height * 0.5}%)`;
  const sideColor = `hsl(30, 40%, ${38 - height * 0.45}%)`;
  const edgeColor = 'rgba(0, 0, 0, 0.22)';

  ctx.fillStyle = sideColor;
  ctx.fillRect(x, y, size, size + height);

  ctx.fillStyle = topColor;
  ctx.fillRect(x, y - height, size, size);

  ctx.strokeStyle = edgeColor;
  ctx.strokeRect(x, y - height, size, size + height);
}

function drawTerrain() {
  ctx.save();
  ctx.translate(-world.offsetX, 0);

  for (let row = 0; row < world.rows; row += 1) {
    for (let col = 0; col < world.cols; col += 1) {
      const screenX = col * world.tileSize + row * 8;
      const screenY = world.horizonY + row * 34;
      drawBlock(screenX, screenY, world.tileSize, heightMap[row][col]);
    }
  }

  ctx.restore();
}

function drawThar() {
  const x = thar.x;
  const y = thar.y;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#1d2636';
  ctx.fillRect(-36, -34, 72, 16);

  ctx.fillStyle = '#d83a2f';
  ctx.fillRect(-39, -20, 78, 26);

  ctx.fillStyle = '#111';
  ctx.fillRect(-44, 2, 20, 20);
  ctx.fillRect(24, 2, 20, 20);

  ctx.fillStyle = '#8fd4ff';
  ctx.fillRect(-22, -16, 19, 12);
  ctx.fillRect(3, -16, 19, 12);

  ctx.fillStyle = '#fce38a';
  ctx.fillRect(-41, -10, 4, 6);
  ctx.fillRect(37, -10, 4, 6);

  ctx.restore();
}

function updateVehicle() {
  if (keys.has('w') || keys.has('ArrowUp')) {
    thar.velocity += 0.25;
  }
  if (keys.has('s') || keys.has('ArrowDown')) {
    thar.velocity -= 0.35;
  }

  thar.velocity *= 0.97;
  thar.velocity = clamp(thar.velocity, 0, thar.maxSpeed);

  let steerDir = 0;
  if (keys.has('a') || keys.has('ArrowLeft')) steerDir -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) steerDir += 1;

  thar.steer += steerDir * 0.9;
  thar.steer *= 0.72;

  thar.x += thar.steer;
  thar.x = clamp(thar.x, 80, canvas.width - 80);

  world.baseSpeed = thar.velocity;
  world.offsetX += world.baseSpeed;
  if (world.offsetX > world.tileSize) {
    world.offsetX = 0;
  }

  world.distance += world.baseSpeed;

  speedLabel.textContent = `Speed: ${world.baseSpeed.toFixed(1)}`;
  distanceLabel.textContent = `Distance: ${Math.floor(world.distance)} m`;
}

function drawSkyEffects(time) {
  const sunX = canvas.width - 120;
  const sunY = 95;
  const pulse = 12 * Math.sin(time / 900);

  ctx.fillStyle = '#ffd35a';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 38 + pulse * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(64 + Math.sin(time / 750) * 10, 70, 140, 20);
  ctx.fillRect(280 + Math.sin(time / 950) * 8, 90, 150, 18);
}

function render(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSkyEffects(time);
  drawTerrain();
  drawThar();
  updateVehicle();

  requestAnimationFrame(render);
}

function deriveScore(mood, comment) {
  let score = moodScores[mood] || 50;
  const tokens = comment.toLowerCase().split(/\W+/).filter(Boolean);

  tokens.forEach((token) => {
    if (Object.hasOwn(keywordBoost, token)) {
      score += keywordBoost[token];
    }
  });

  return clamp(score, 0, 100);
}

function saveSentiment(auto = false) {
  const mood = moodSelect.value;
  const comment = commentInput.value.trim();
  const score = deriveScore(mood, comment);
  const event = {
    mood,
    comment,
    score,
    auto,
    ts: new Date().toISOString(),
  };

  sentimentHistory.unshift(event);
  sentimentHistory.splice(30);
  localStorage.setItem('thar-sentiment-history', JSON.stringify(sentimentHistory));
  moodLabel.textContent = `Live Mood: ${mood} (${score})`;

  renderSentiment();
}

function renderSentiment() {
  logList.innerHTML = '';
  sentimentHistory.slice(0, 8).forEach((item) => {
    const li = document.createElement('li');
    const stamp = new Date(item.ts).toLocaleTimeString();
    li.textContent = `${stamp} — ${item.mood} (${item.score}) ${item.auto ? '[auto]' : '[manual]'}${item.comment ? `: ${item.comment}` : ''}`;
    logList.appendChild(li);
  });

  chart.innerHTML = '';
  const samples = sentimentHistory.slice(0, 12).reverse();
  samples.forEach((item) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${item.score}%`;
    bar.style.background = item.score >= 70 ? '#4fcc7b' : item.score >= 40 ? '#f5c35c' : '#ff637d';
    bar.title = `${item.mood}: ${item.score}`;
    chart.appendChild(bar);
  });
}

window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));

saveMoodBtn.addEventListener('click', () => saveSentiment(false));

setInterval(() => {
  saveSentiment(true);
}, 10000);

if (sentimentHistory.length === 0) {
  saveSentiment(true);
} else {
  renderSentiment();
  const latest = sentimentHistory[0];
  moodLabel.textContent = `Live Mood: ${latest.mood} (${latest.score})`;
}

requestAnimationFrame(render);
