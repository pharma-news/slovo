/* Машинопись по четырём частям экрана.
   Печать каждой четверти запускается её же кнопкой со значком (внизу слева),
   пояснение к слову — своей кнопкой (внизу справа). Никакого меню: только
   кружок темы посередине экрана да клавиши (см. README).
   Тексты, слова и объяснения — в data.js. */

(function () {
  'use strict';

  var FR = (window.FRAGMENTS || []).slice(0, 4);
  if (!FR.length) { document.body.innerHTML = '<p style="padding:2em">Не загружен data.js</p>'; return; }

  var root = document.documentElement;
  var stage = document.getElementById('stage');
  var panels = Array.prototype.slice.call(stage.querySelectorAll('.panel'));
  var clockEl = document.getElementById('clock');
  var btnTheme = document.getElementById('btnTheme');

  /* ── темы: тёмная, белая, бежевая (кружок посередине экрана) ── */
  var THEMES = [
    { id: 'dark', label: 'тёмная', icon: '🌙' },
    { id: 'light', label: 'белая', icon: '☀️' },
    { id: 'beige', label: 'бежевая', icon: '📜' }
  ];
  var themeIdx = 0;
  try {
    var savedTheme = localStorage.getItem('slovo-theme');
    for (var s = 0; s < THEMES.length; s++) if (THEMES[s].id === savedTheme) themeIdx = s;
  } catch (e) { /* приватный режим — не страшно */ }

  function applyTheme() {
    var t = THEMES[themeIdx];
    root.setAttribute('data-theme', t.id);
    btnTheme.textContent = t.icon;
    btnTheme.title = 'Тема: ' + t.label + ' → ' + THEMES[(themeIdx + 1) % THEMES.length].label;
    try { localStorage.setItem('slovo-theme', t.id); } catch (e) {}
  }

  /* ── скорость (по умолчанию медленная) и паузы машинки ──────── */
  var SPEEDS = [
    { name: 'медленно', ms: 96 },
    { name: 'средне', ms: 56 },
    { name: 'быстро', ms: 32 }
  ];
  var speedIdx = 0;
  var P = { comma: 300, end: 470, line: 560, hl: 2.0 };
  function speed() { return SPEEDS[speedIdx].ms; }
  function speedK() { return speed() / SPEEDS[1].ms; }
  var paused = false;

  /* ── разбор текста: строки, слова, выделенное слово ─────────── */
  function splitMarkup(str) {
    var out = [], re = /\*([^*]+)\*/g, m, last = 0;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) out.push({ t: str.slice(last, m.index), hl: false });
      out.push({ t: m[1], hl: true });
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push({ t: str.slice(last), hl: false });
    return out;
  }

  function toWords(tokens) {
    var words = [];
    tokens.forEach(function (tk) {
      tk.t.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        words.push({ text: p, hl: tk.hl && !/^\s+$/.test(p) });
      });
    });
    return words;
  }

  /* ── собираем четверти ──────────────────────────────────────── */
  var frags = [];

  FR.forEach(function (f, fi) {
    var panel = panels[fi];
    var verse = document.createElement('div');
    verse.className = 'verse';

    var items = [];
    var lineEndIdx = {};
    f.text.split('\n').map(function (ln) { return toWords(splitMarkup(ln)); }).forEach(function (words) {
      var lineEl = document.createElement('div');
      lineEl.className = 'line';
      words.forEach(function (w) {
        var sp = document.createElement('span');
        sp.className = 'w' + (w.hl ? ' hl' : '');
        sp.textContent = '';
        lineEl.appendChild(sp);
        items.push({ text: w.text, el: sp, hl: w.hl });
      });
      lineEndIdx[items.length - 1] = true;
      verse.appendChild(lineEl);
    });

    var src = document.createElement('div');
    src.className = 'src';
    src.textContent = f.source || '';

    var card = document.createElement('div');
    card.className = 'card';
    var cw = document.createElement('p'); cw.className = 'card__word'; cw.textContent = f.answer || '';
    var cg = document.createElement('p'); cg.className = 'card__gloss'; cg.textContent = f.gloss || '';
    card.appendChild(cw); card.appendChild(cg);
    if (f.note) { var cn = document.createElement('p'); cn.className = 'card__note'; cn.textContent = f.note; card.appendChild(cn); }

    var bPlay = document.createElement('button');
    bPlay.className = 'pbtn pbtn--play';
    bPlay.title = 'Печатать этот отрывок';
    bPlay.textContent = '▶';

    var bCard = document.createElement('button');
    bCard.className = 'pbtn pbtn--card';
    bCard.title = 'Пояснение к слову';
    bCard.textContent = '?';

    var frCursor = document.createElement('span');
    frCursor.className = 'cursor';

    panel.appendChild(verse);
    panel.appendChild(src);
    panel.appendChild(card);
    panel.appendChild(bPlay);
    panel.appendChild(bCard);

    frags.push({
      index: fi, panel: panel, verseEl: verse, srcEl: src, cardEl: card,
      btnPlay: bPlay, btnCard: bCard, cursorEl: frCursor,
      items: items, lineEndIdx: lineEndIdx,
      raw: f.text, size: f.size || 1, prose: f.text.indexOf('\n') === -1,
      pos: 0, ci: 0, timer: null, running: false, done: false, cardOpen: false
    });
  });

  /* ── подбор кегля под размер четверти ───────────────────────── */
  function fillFull(fr, on) {
    fr.items.forEach(function (it) { it.el.textContent = on ? it.text : ''; });
  }

  function restorePartial(fr) {
    for (var i = 0; i < fr.items.length; i++) {
      if (i < fr.pos) fr.items[i].el.textContent = fr.items[i].text;
      else if (i === fr.pos) fr.items[i].el.textContent = fr.items[i].text.slice(0, fr.ci);
      else fr.items[i].el.textContent = '';
    }
    if (fr.running && !paused) {
      var it = fr.items[fr.pos];
      it.el.parentNode.insertBefore(fr.cursorEl, it.el.nextSibling);
      fr.timer = setTimeout(function () { fragStep(fr); }, 400);
    }
  }

  function overflows(fr, fs, H) {
    fr.verseEl.style.fontSize = fs + 'px';
    var cs = window.getComputedStyle(fr.panel);
    var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var avail = fr.panel.clientHeight - pad - fr.srcEl.offsetHeight;
    if (fr.verseEl.offsetHeight > avail) return true;
    if (fr.prose) return false;                     // прозу переносить можно
    var oneLine = (parseFloat(window.getComputedStyle(fr.verseEl).lineHeight) || fs * 1.58);
    if (oneLine < fs) oneLine = fs * 1.58;
    var kids = fr.verseEl.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].offsetHeight > oneLine * 1.3) return true;   // стихотворная строка перенеслась
    }
    return false;
  }

  function fitVerse(fr) {
    var H = window.innerHeight;
    fr.verseEl.style.minHeight = '0px';
    var hi = Math.max(20, Math.min(54, 0.019 * H + 0.011 * window.innerWidth)) * (fr.size || 1);
    fillFull(fr, true);
    if (!overflows(fr, hi, H)) {
      fr.verseEl.style.minHeight = fr.verseEl.offsetHeight + 'px';
      return;
    }
    var lo = 13;
    for (var k = 0; k < 10; k++) {
      var mid = (lo + hi) / 2;
      if (overflows(fr, mid, H)) hi = mid; else lo = mid;
    }
    fr.verseEl.style.fontSize = Math.floor(lo) + 'px';
    fr.verseEl.style.minHeight = fr.verseEl.offsetHeight + 'px';
  }

  function fitCard(fr) {
    var H = fr.panel.clientHeight, lim = H * 0.56;
    var lo = 12, hi = Math.max(16, Math.min(26, 0.013 * H + 0.006 * window.innerWidth));
    var savedMax = fr.cardEl.style.maxHeight;
    fr.cardEl.style.maxHeight = 'none';
    fr.cardEl.style.visibility = 'hidden';
    fr.cardEl.style.fontSize = hi + 'px';
    if (fr.cardEl.offsetHeight > lim) {
      for (var k = 0; k < 9; k++) {
        var mid = (lo + hi) / 2;
        fr.cardEl.style.fontSize = mid + 'px';
        if (fr.cardEl.offsetHeight > lim) hi = mid; else lo = mid;
      }
      fr.cardEl.style.fontSize = Math.floor(lo) + 'px';
    }
    fr.cardEl.style.visibility = '';
    fr.cardEl.style.maxHeight = savedMax;
  }

  function layout() {
    frags.forEach(function (fr) {
      var wasRunning = fr.running;
      clearTimeout(fr.timer); fr.timer = null;
      fr.running = false;
      fitVerse(fr);
      fillFull(fr, false);
      if (fr.done) fillFull(fr, true);
      if (wasRunning) { fr.running = true; restorePartial(fr); }
      fitCard(fr);
    });
  }
  var layoutTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(layout, 200);
  });
  layout();

  /* ── машинка: каждая четверть печатает сама по себе ─────────── */
  function renderFr(fr) {
    var it = fr.items[fr.pos];
    it.el.textContent = it.text.slice(0, fr.ci);
    it.el.parentNode.insertBefore(fr.cursorEl, it.el.nextSibling);
  }

  function pauseAfter(item, isLineEnd, isLast) {
    var d;
    if (isLast) d = 260;
    else if (isLineEnd) d = P.line;
    else {
      var tail = item.text.replace(/\s+$/, '').slice(-1);
      if (/,—$/.test(tail)) d = P.comma * 0.8;
      else if (/[;:]/.test(tail)) d = P.comma;
      else if (/[.?!…»]/.test(tail)) d = P.end;
      else d = 0;
    }
    return d * speedK();
  }

  function fragStep(fr) {
    if (!fr.running || paused) return;
    fr.timer = null;
    var it = fr.items[fr.pos];

    if (fr.ci < it.text.length) {
      fr.ci++;
      renderFr(fr);
      var base = speed() * (it.hl ? P.hl : 1);
      var extra = /[—–]/.test(it.text.charAt(fr.ci - 1)) ? base * 2 : 0;
      fr.timer = setTimeout(function () { fragStep(fr); }, base * (0.75 + Math.random() * 0.5) + extra);
      return;
    }

    var isLast = fr.pos === fr.items.length - 1;
    var wait = pauseAfter(it, !!fr.lineEndIdx[fr.pos], isLast);
    if (isLast) { finishFr(fr); return; }
    fr.pos++; fr.ci = 0;
    if (wait) fr.timer = setTimeout(function () { fragStep(fr); }, wait);
    else fragStep(fr);
  }

  function startFr(fr) {
    clearTimeout(fr.timer); fr.timer = null;
    fr.items.forEach(function (it) { it.el.textContent = ''; });
    if (fr.cursorEl.parentNode) fr.cursorEl.parentNode.removeChild(fr.cursorEl);
    setCard(fr, false);
    fr.pos = 0; fr.ci = 0; fr.done = false; fr.running = true;
    fr.panel.classList.add('active');
    fr.panel.classList.remove('done');
    if (paused) return;                       // печатаем, когда снимут паузу
    fr.timer = setTimeout(function () { fragStep(fr); }, 320);
  }

  function finishFr(fr) {
    fr.running = false;
    fr.done = true;
    clearTimeout(fr.timer); fr.timer = null;
    if (fr.cursorEl.parentNode) fr.cursorEl.parentNode.removeChild(fr.cursorEl);
    fr.panel.classList.remove('active');
    fr.panel.classList.add('done');
    fr.btnPlay.title = 'Печатать этот отрывок заново';
  }

  function fastForward(fr) {
    if (!fr || fr.done) return;
    clearTimeout(fr.timer); fr.timer = null;
    fr.items.forEach(function (it) { it.el.textContent = it.text; });
    finishFr(fr);
  }

  /* ── пояснение: своя карточка у каждой четверти ─────────────── */
  function setCard(fr, on) {
    fr.cardOpen = !!on;
    fr.panel.classList.toggle('card-open', !!on);
    fr.btnCard.classList.toggle('pbtn--on', !!on);
  }

  function toggleRevealAll() {
    var open = !frags.every(function (fr) { return fr.cardOpen; });
    frags.forEach(function (fr) { setCard(fr, open); });
  }

  /* ── весь экран сразу ────────────────────────────────────────── */
  function clearScreen() {
    frags.forEach(function (fr) {
      clearTimeout(fr.timer); fr.timer = null;
      if (fr.cursorEl.parentNode) fr.cursorEl.parentNode.removeChild(fr.cursorEl);
      fr.items.forEach(function (it) { it.el.textContent = ''; });
      fr.pos = 0; fr.ci = 0; fr.running = false; fr.done = false;
      fr.panel.classList.remove('active', 'done');
      fr.btnPlay.title = 'Печатать этот отрывок';
      setCard(fr, false);
    });
    paused = false;
  }

  function setPause(v) {
    paused = !!v;
    if (paused) {
      frags.forEach(function (fr) { clearTimeout(fr.timer); fr.timer = null; });
    } else {
      frags.forEach(function (fr) {
        if (fr.running && !fr.timer) fr.timer = setTimeout(function () { fragStep(fr); }, 300);
      });
    }
  }

  /* ── клавиши ─────────────────────────────────────────────────── */
  function cycleSpeed() { speedIdx = (speedIdx + 1) % SPEEDS.length; }

  var clockOn = false, clockT0 = 0, clockInt = null;
  function fmt(ms) {
    var sec = Math.floor(ms / 1000), m = Math.floor(sec / 60);
    return (m < 10 ? '0' + m : m) + ':' + ((sec % 60) < 10 ? '0' + (sec % 60) : (sec % 60));
  }
  function toggleClock() {
    clockOn = !clockOn;
    clockEl.hidden = !clockOn;
    clearInterval(clockInt);
    if (clockOn) {
      clockT0 = Date.now();
      clockEl.textContent = '00:00';
      clockInt = setInterval(function () { clockEl.textContent = fmt(Date.now() - clockT0); }, 500);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  function nextTheme() { themeIdx = (themeIdx + 1) % THEMES.length; applyTheme(); }

  /* ── события ────────────────────────────────────────────────── */
  btnTheme.addEventListener('click', nextTheme);

  frags.forEach(function (fr) {
    fr.btnPlay.addEventListener('click', function (e) { e.stopPropagation(); startFr(fr); });
    fr.btnCard.addEventListener('click', function (e) { e.stopPropagation(); setCard(fr, !fr.cardOpen); });
    fr.panel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.pbtn')) return;
      if (fr.running) fastForward(fr);      // клик по четверти — допечатать её целиком
    });
  });

  document.addEventListener('dblclick', function (e) {
    if (e.target.closest && (e.target.closest('.pbtn') || e.target.closest('.theme-fab'))) return;
    toggleFullscreen();
  });

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); setPause(!paused); }
    else if (k === 'r' || k === 'R' || k === 'к' || k === 'К' || k === 'Home') { clearScreen(); }
    else if (k === 'v' || k === 'V' || k === 'м' || k === 'М') { cycleSpeed(); }
    else if (k === 't' || k === 'T' || k === 'е' || k === 'Е') { nextTheme(); }
    else if (k === 'e' || k === 'E' || k === 'у' || k === 'У') { toggleRevealAll(); }
    else if (k === 'c' || k === 'C' || k === 'с' || k === 'С') { toggleClock(); }
    else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') { toggleFullscreen(); }
    else if (k === 'p' || k === 'P' || k === 'з' || k === 'З') { document.body.classList.toggle('nosrc'); }
    else if (k === '1' || k === '2' || k === '3' || k === '4') { startFr(frags[+k - 1]); }
    else if (k === 'PageDown' || k === 'ArrowRight') {
      fastForward(frags.filter(function (x) { return x.running; })[0] || frags.filter(function (x) { return !x.done; })[0]);
    }
  });

  applyTheme();
  clearScreen();
})();
