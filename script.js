(() => {
  const rainCanvas = document.getElementById('rain');
  const glassCanvas = document.getElementById('glass');
  const rc = rainCanvas.getContext('2d');
  const gc = glassCanvas.getContext('2d');
  const sillEl = document.getElementById('sill');
  const windowEl = document.getElementById('window');
  const slider = document.getElementById('intensity');
  const soundBtn = document.getElementById('sound');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = (a, b) => a + Math.random() * (b - a);
  let W, H, gw, gh, dpr, sill = { x1: 0, x2: 0, y: 0 };
  let intensity = slider.value / 100;

  /* ---------- Redimensionnement ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    rainCanvas.width = W * dpr; rainCanvas.height = H * dpr;
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = windowEl.getBoundingClientRect();
    gw = g.width; gh = g.height;
    glassCanvas.width = gw * dpr; glassCanvas.height = gh * dpr;
    gc.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = sillEl.getBoundingClientRect();
    sill = { x1: s.left, x2: s.right, y: s.top };
  }
  addEventListener('resize', resize);
  resize();

  /* ---------- Pluie à l'extérieur ---------- */
  const wind = -0.12;
  let streaks = [];
  let splashes = [];

  function newStreak(anywhere) {
    return {
      x: rand(-100, W + 100),
      y: anywhere ? rand(-H, H) : rand(-200, -10),
      len: rand(12, 34),
      speed: rand(700, 1300),
      alpha: rand(0.12, 0.4)
    };
  }

  function updateRain(dt) {
    const target = Math.round(80 + intensity * 520);
    while (streaks.length < target) streaks.push(newStreak(true));
    if (streaks.length > target) streaks.length = target;

    rc.clearRect(0, 0, W, H);
    rc.lineCap = 'round';
    for (const s of streaks) {
      const dy = s.speed * dt;
      const prevY = s.y;
      s.y += dy;
      s.x += dy * wind;

      // Impact sur le rebord de la fenêtre
      if (prevY < sill.y && s.y >= sill.y && s.x > sill.x1 && s.x < sill.x2) {
        for (let i = 0; i < 3; i++) {
          splashes.push({ x: s.x, y: sill.y, vx: rand(-60, 60), vy: rand(-170, -60), life: 1 });
        }
        Object.assign(s, newStreak(false));
        continue;
      }
      if (s.y > H + 40) { Object.assign(s, newStreak(false)); continue; }

      rc.strokeStyle = `rgba(200,220,245,${s.alpha})`;
      rc.lineWidth = s.alpha > 0.28 ? 1.4 : 0.9;
      rc.beginPath();
      rc.moveTo(s.x, s.y);
      rc.lineTo(s.x - wind * s.len, s.y - s.len);
      rc.stroke();
    }

    // Éclaboussures
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i];
      p.vy += 700 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt * 3;
      if (p.life <= 0) { splashes.splice(i, 1); continue; }
      rc.fillStyle = `rgba(210,228,250,${p.life * 0.7})`;
      rc.beginPath(); rc.arc(p.x, p.y, 1.2, 0, Math.PI * 2); rc.fill();
    }
  }

  /* ---------- Gouttes sur la vitre ---------- */
  let drops = [];
  const MAX_DROPS = 160;

  function addDrop(x, y, r) {
    drops.push({
      x, y, r,
      vy: 0,
      moving: false,
      slideAt: rand(5.5, 9),
      wobble: rand(0, 10)
    });
  }

  function spawnGlassDrops(dt) {
    const rate = 4 + intensity * 26; // gouttes par seconde
    if (Math.random() < rate * dt && drops.length < MAX_DROPS) {
      addDrop(rand(6, gw - 6), rand(6, gh - 6), rand(1.4, 4.2));
    }
  }

  function updateDrops(dt) {
    // Fusion des gouttes proches
    for (let i = 0; i < drops.length; i++) {
      const a = drops[i];
      if (!a) continue;
      for (let j = i + 1; j < drops.length; j++) {
        const b = drops[j];
        if (!b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < (a.r + b.r) * 0.85) {
          const big = a.r >= b.r ? a : b;
          const small = big === a ? b : a;
          const area = big.r * big.r + small.r * small.r;
          big.x = (big.x * big.r + small.x * small.r) / (big.r + small.r);
          big.y = (big.y * big.r + small.y * small.r) / (big.r + small.r);
          big.r = Math.sqrt(area);
          big.vy = Math.max(big.vy, small.vy);
          drops[drops.indexOf(small)] = null;
        }
      }
    }
    drops = drops.filter(Boolean);

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];

      if (!d.moving && d.r > d.slideAt) d.moving = true;

      if (d.moving) {
        const maxV = 40 + d.r * 14;
        d.vy += (maxV - d.vy) * dt * 1.5 * rand(0.2, 1.6);
        if (Math.random() < dt * 0.6) d.vy *= 0.25;     // petit arrêt
        d.wobble += dt * 6;
        const dy = d.vy * dt;
        d.y += dy;
        d.x += Math.sin(d.wobble) * dt * 6;

        // Traînée : petites gouttelettes laissées derrière
        d.trail = (d.trail || 0) + dy;
        if (d.trail > 7 && d.r > 3) {
          d.trail = 0;
          addDrop(d.x + rand(-1, 1), d.y - d.r, rand(0.8, 1.7));
          d.r *= 0.992;
        }
        if (d.r < 4.2) { d.moving = false; d.vy = 0; d.slideAt = rand(6, 9); }
      }

      if (d.y - d.r > gh) drops.splice(i, 1);
    }
  }

  function drawDrop(d) {
    const stretch = 1 + Math.min(d.vy / 160, 0.6);
    const rx = d.r, ry = d.r * stretch;

    // Corps : transparent, bord plus clair en bas (réfraction)
    const g = gc.createRadialGradient(d.x, d.y + ry * 0.25, ry * 0.1, d.x, d.y, ry);
    g.addColorStop(0, 'rgba(255,220,160,0.22)');
    g.addColorStop(0.65, 'rgba(210,225,245,0.10)');
    g.addColorStop(1, 'rgba(15,20,30,0.40)');
    gc.fillStyle = g;
    gc.beginPath();
    gc.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2);
    gc.fill();

    // Reflet de lumière en bas
    gc.fillStyle = 'rgba(255,240,210,0.35)';
    gc.beginPath();
    gc.ellipse(d.x, d.y + ry * 0.45, rx * 0.5, ry * 0.25, 0, 0, Math.PI * 2);
    gc.fill();

    // Point brillant en haut à gauche
    if (d.r > 2) {
      gc.fillStyle = 'rgba(255,255,255,0.8)';
      gc.beginPath();
      gc.arc(d.x - rx * 0.35, d.y - ry * 0.4, Math.max(0.6, rx * 0.18), 0, Math.PI * 2);
      gc.fill();
    }
  }

  function renderGlass() {
    gc.clearRect(0, 0, gw, gh);
    for (const d of drops) drawDrop(d);
  }

  // Un clic ajoute une grosse goutte
  windowEl.addEventListener('pointerdown', (e) => {
    const r = glassCanvas.getBoundingClientRect();
    addDrop(e.clientX - r.left, e.clientY - r.top, rand(6, 9));
  });

  // Départ : quelques gouttes déjà posées
  for (let i = 0; i < 40; i++) addDrop(rand(6, gw - 6), rand(6, gh - 6), rand(1.5, 5));

  /* ---------- Son de pluie (Web Audio) ---------- */
  let audio = null;
  function startSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {            // bruit légèrement filtré
      const w = Math.random() * 2 - 1;
      last = (last + 0.35 * w) / 1.35;
      data[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    src.start();
    audio = { ctx, gain };
    setVolume();
  }
  function setVolume() {
    if (audio) audio.gain.gain.setTargetAtTime(0.04 + intensity * 0.22, audio.ctx.currentTime, 0.2);
  }
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', on);
    soundBtn.textContent = on ? 'Couper le son de la pluie' : 'Activer le son de la pluie';
    if (on) { if (!audio) startSound(); else audio.ctx.resume(); setVolume(); }
    else if (audio) audio.ctx.suspend();
  });
  slider.addEventListener('input', () => { intensity = slider.value / 100; setVolume(); });

  /* ---------- Boucle ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    updateRain(dt);
    spawnGlassDrops(dt);
    updateDrops(dt);
    renderGlass();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (reduceMotion) intensity = Math.min(intensity, 0.3);
})();

