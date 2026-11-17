/* Тихий мир на заднем плане: дали, лес, поле, свет.
   Рисуется под текущий размер окна и перерисовывается при его изменении.
   Совсем незаметный сам по себе — вау-эффект даёт в движении и в полутьме. */

(function () {
  'use strict';

  var art = document.getElementById('sceneArt');
  var motesHost = document.getElementById('sceneMotes');
  if (!art) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var groups = [];

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // холм: сумма синусов, закрытая до низа
  function hillPath(w, h, base, amp, freq, phase) {
    var pts = [], step = Math.max(6, w / 160);
    for (var x = 0; x <= w; x += step) {
      var y = base + amp * (Math.sin(x * freq + phase) +
                0.55 * Math.sin(x * freq * 2.1 + phase * 1.6) +
                0.28 * Math.sin(x * freq * 4.6 + phase * 0.7));
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    return 'M0,' + h + ' L' + pts.join(' L') + ' L' + w + ',' + h + ' Z';
  }

  // ель/берёза: тёмный штрих на линии леса
  function conifer(x, base, hgt, wid) {
    return 'M' + (x - wid) + ',' + base +
           ' L' + x + ',' + (base - hgt) +
           ' L' + (x + wid) + ',' + base + ' Z';
  }
  function deciduous(x, base, hgt, wid) {
    var y = base - hgt;
    return 'M' + (x - wid) + ',' + (y + hgt * 0.42) +
           ' a' + wid + ',' + (hgt * 0.5) + ' 0 1 1 ' + (2 * wid) + ',0' +
           ' a' + wid + ',' + (hgt * 0.5) + ' 0 1 1 ' + (-2 * wid) + ',0 Z';
  }

  function stalk(x, base, hgt, bend, head) {
    var d = 'M' + x + ',' + base +
            ' C' + (x + bend * 0.3) + ',' + (base - hgt * 0.45) +
            ' ' + (x + bend * 0.75) + ',' + (base - hgt * 0.8) +
            ' ' + (x + bend) + ',' + (base - hgt);
    var out = [d];
    if (head) {
      out.push('M' + (x + bend) + ',' + (base - hgt) +
               ' m-1.4,0 a1.4,' + (hgt * 0.09) + ' 0 1 0 2.8,0 a1.4,' + (hgt * 0.09) + ' 0 1 0 -2.8,0');
    }
    return out.join(' ');
  }

  function build() {
    var W = window.innerWidth, H = window.innerHeight;
    while (art.firstChild) art.removeChild(art.firstChild);
    groups = [];
    art.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    art.setAttribute('width', W);
    art.setAttribute('height', H);

    var defs = el('defs', {});
    var g1 = el('linearGradient', { id: 'sc-hillfade', x1: '0', y1: '0', x2: '0', y2: '1' });
    g1.appendChild(el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0.9' }));
    g1.appendChild(el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0.25' }));
    defs.appendChild(g1);
    var mask = el('mask', { id: 'sc-fademask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H });
    mask.appendChild(el('rect', { x: 0, y: H * 0.54, width: W, height: H * 0.46, fill: 'url(#sc-hillfade)' }));
    defs.appendChild(mask);
    art.appendChild(defs);

    var plot = el('g', { mask: 'url(#sc-fademask)' });
    art.appendChild(plot);

    // ── дали и холмы: три слоя с лёгким параллаксом ─────────────
    var hills = [
      { base: H * 0.700, amp: H * 0.018, freq: 0.0016, phase: 0.4, cls: 'sc-far' },
      { base: H * 0.780, amp: H * 0.024, freq: 0.0022, phase: 2.1, cls: 'sc-mid' },
      { base: H * 0.855, amp: H * 0.026, freq: 0.0031, phase: 4.4, cls: 'sc-near' }
    ];
    hills.forEach(function (cfg, i) {
      var layer = el('g', { class: 'sc-layer sc-shift' + i });
      layer.appendChild(el('path', { class: cfg.cls, d: hillPath(W, H, cfg.base, cfg.amp, cfg.freq, cfg.phase) }));
      plot.appendChild(layer);
      groups.push({ node: layer, depth: 0.35 + i * 0.35 });
    });

    // ── линия леса: дальняя (мельче) и ближняя ──────────────────
    [[H * 0.845, 0.6, 'sc-wood-far', 5], [H * 0.900, 1, 'sc-wood', 11]].forEach(function (row, ri) {
      var base = row[0], k = row[1], cls = row[2], step = row[3] * (W < 700 ? 0.8 : 1);
      var layer = el('g', { class: 'sc-layer sc-wood' + ri });
      var d = '';
      for (var x = -10; x < W + 10; x += rnd(step * 0.7, step * 1.4)) {
        var hgt = rnd(H * 0.030, H * 0.062) * k;
        var wid = hgt * rnd(0.18, 0.30);
        d += (Math.random() < 0.72 ? conifer(x, base, hgt, wid) : deciduous(x, base, hgt, wid * 1.35)) + ' ';
      }
      layer.appendChild(el('path', { class: cls, d: d }));
      // кусты перед лесом
      var d2 = '';
      for (var bx = 0; bx < W; bx += rnd(160, 380)) {
        var bh = rnd(H * 0.012, H * 0.026);
        d2 += 'M' + bx + ',' + (base + 6) + ' a' + rnd(26, 60) + ',' + bh + ' 0 1 1 ' + (2 * 40) + ',0 a' + 40 + ',' + bh + ' 0 1 1 ' + (-2 * 40) + ',0 ';
      }
      layer.appendChild(el('path', { class: cls, d: d2, opacity: '0.55' }));
      plot.appendChild(layer);
      groups.push({ node: layer, depth: 1.1 + ri * 0.9 });
    });

    // ── поле: стебли, которые качаются, как на ветру ────────────
    var fieldTop = H * 0.915;
    var bands = [[0.30, 6], [0.55, 7], [0.85, 8]];   // глубина и частота
    bands.forEach(function (band, bi) {
      var g = el('g', { class: 'sc-sway sc-sway' + bi + ' sc-field' });
      var y0 = H - bi * (H - fieldTop) / 2.2;
      var step = band[1] * (W < 700 ? 0.9 : 1);
      var d = '';
      for (var x = -8; x < W + 8; x += rnd(step, step * 1.9)) {
        d += stalk(x, y0 + rnd(-4, 10), rnd(H * 0.035, H * 0.085) * band[0] + H * 0.02, rnd(-7, 7), Math.random() < 0.22) + ' ';
      }
      g.appendChild(el('path', { d: d, fill: 'none' }));
      plot.appendChild(g);
      groups.push({ node: g, depth: 1.6 + bi * 0.5 });
    });

    // ── птицы в небе: два тихих каравана (крылья машут вокруг корпуса) ──
    var flocks = [
      { y: H * rnd(0.055, 0.11), n: 4, size: rnd(8, 12), fly: rnd(260, 380) },
      { y: H * rnd(0.13, 0.19), n: 3, size: rnd(6, 9),  fly: rnd(380, 520) }
    ];
    flocks.forEach(function (cfg, fi) {
      var flock = el('g', { class: 'sc-flock' });
      flock.style.setProperty('--fly', cfg.fly.toFixed(0) + 's');
      flock.style.animationDelay = (-rnd(0, cfg.fly * 0.7)).toFixed(0) + 's';
      if (fi === 1) flock.style.opacity = '.7';
      var bob = el('g', { class: 'sc-bob' });
      bob.style.setProperty('--bob', rnd(6, 10).toFixed(1) + 's');
      var x0 = W * rnd(0.05, 0.2);
      for (var b = 0; b < cfg.n; b++) {
        var bx = x0 + b * cfg.size * rnd(2.6, 3.8);
        var by = cfg.y + rnd(-H * 0.014, H * 0.014) + b * rnd(-3, 5);
        var sw = cfg.size;              // размах одного крыла
        var up = sw * 0.62;             // подъём крыла
        var bird = el('g', { class: 'sc-bird', transform: 'translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ')' });
        bird.style.setProperty('--flap', rnd(1.3, 2.2).toFixed(2) + 's');
        bird.style.setProperty('--fdelay', (-rnd(0, 2)).toFixed(2) + 's');
        // левое и правое крылья: дуга от корпуса в сторону и вверх
        bird.appendChild(el('path', { class: 'sc-wing sc-wing-l', d: 'M0,0 Q' + (-sw * 0.62) + ',' + (-up) + ' ' + (-sw * 1.15) + ',' + (-up * 0.28) }));
        bird.appendChild(el('path', { class: 'sc-wing sc-wing-r', d: 'M0,0 Q' + (sw * 0.62) + ',' + (-up) + ' ' + (sw * 1.15) + ',' + (-up * 0.28) }));
        // корпус — совсем маленькая чёрточка
        bird.appendChild(el('path', { class: 'sc-body', d: 'M' + (-sw * 0.22) + ',0 Q0,' + (sw * 0.16) + ' ' + (sw * 0.22) + ',0' }));
        bob.appendChild(bird);
      }
      flock.appendChild(bob);
      art.appendChild(flock);      // поверх маски: птицы видны в самом небе
    });

    // ── былинки-крупинки в воздухе ───────────────────────────────
    if (motesHost) {
      motesHost.innerHTML = '';
      var n = W < 700 ? 12 : 22;
      for (var i = 0; i < n; i++) {
        var s = document.createElement('i');
        s.style.left = rnd(2, 98).toFixed(1) + '%';
        s.style.top = rnd(38, 96).toFixed(1) + '%';
        s.style.setProperty('--sz', rnd(1.6, 3.6).toFixed(1) + 'px');
        s.style.setProperty('--dur', rnd(26, 62).toFixed(0) + 's');
        s.style.setProperty('--delay', (-rnd(0, 40)).toFixed(0) + 's');
        s.style.setProperty('--dx', rnd(-60, 60).toFixed(0) + 'px');
        motesHost.appendChild(s);
      }
    }
    setShift(0, 0);
  }

  /* ── мягкий параллакс: мир чуть-чуть уходит за курсором ──────── */
  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  function setShift(x, y) {
    groups.forEach(function (g) {
      g.node.style.transform = 'translate3d(' + (x * g.depth).toFixed(2) + 'px,' + (y * g.depth * 0.45).toFixed(2) + 'px,0)';
    });
  }
  function tick() {
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;
    setShift(cx, cy);
    if (Math.abs(tx - cx) > 0.15 || Math.abs(ty - cy) > 0.15) raf = requestAnimationFrame(tick);
    else raf = null;
  }
  function onMove(e) {
    if (reduceQuery.matches) return;
    var w = window.innerWidth, h = window.innerHeight;
    tx = ((e.clientX / w) - 0.5) * -26;
    ty = ((e.clientY / h) - 0.5) * -14;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function onTouch(e) {
    if (!e.touches || !e.touches[0]) return;
    onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  }

  var t = null;
  function rebuild() { clearTimeout(t); t = setTimeout(build, 200); }

  build();
  window.addEventListener('resize', rebuild);
  window.addEventListener('orientationchange', rebuild);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', rebuild);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', build);
})();
