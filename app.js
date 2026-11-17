/* Машинопись по четырём частям экрана + режим объяснений.
   Все тексты и слова-загадки — в data.js, здесь только механика. */

(function () {
  'use strict';

  var FR = (window.FRAGMENTS || []).slice(0, 4);
  if (!FR.length) { document.body.innerHTML = '<p style="padding:2em">Не загружен data.js</p>'; return; }

  var stage = document.getElementById('stage');
  var panels = Array.prototype.slice.call(stage.querySelectorAll('.panel'));
  var brand = document.getElementById('brand');
  var brandSub = brand.querySelector('.brand__sub');
  var BRAND_DEFAULT = brandSub.textContent;
  var BRAND_READY = 'Все четыре отрывка напечатаны · ищите выделенные слова в «Словаре языка Пушкина» · <b>E</b> — пояснения';
  var countdown = document.getElementById('countdown');
  var countdownNum = document.getElementById('countdownNum');
  var clockEl = document.getElementById('clock');
  var btnPlay = document.getElementById('btnPlay');
  var btnRestart = document.getElementById('btnRestart');
  var btnSpeed = document.getElementById('btnSpeed');
  var btnSrc = document.getElementById('btnSrc');
  var btnClock = document.getElementById('btnClock');
  var btnFull = document.getElementById('btnFull');
  var btnReveal = document.getElementById('btnReveal');
  var bar = document.getElementById('bar');

  /* ── скорость: число миллисекунд на один знак ───────────────── */
  var SPEEDS = [
    { name: 'медленно', ms: 96 },
    { name: 'средне', ms: 56 },
    { name: 'быстро', ms: 32 }
  ];
  var speedIdx = 1;

  /* паузы между делами (в миллисекундах «средней» скорости) */
  var P = {
    comma: 300,
    end: 470,
    line: 560,
    frag: 1700,
    hl: 2.0        // загаданное слово печатаем с расстановкой
  };

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

  /* ── собираем панели ────────────────────────────────────────── */
  var cursor = document.createElement('span');
  cursor.className = 'cursor';

  var frags = [];      // по одной записи на отрывок
  var seq = [];        // все «слова» (вместе с пробелами) подряд, по порядку печати
  var fragStart = [];  // индекс в seq, где начинается отрывок
  var fragEnd = [];    // индекс в seq, где он заканчивается

  FR.forEach(function (f, fi) {
    var panel = panels[fi];
    var startIdx = seq.length;
    var verse = document.createElement('div');
    verse.className = 'verse';
    verse.style.setProperty('--fs', f.size || 1);

    var lineEnds = {};   // индекс последнего слова в строке
    var lines = f.text.split('\n').map(function (ln) { return toWords(splitMarkup(ln)); });

    lines.forEach(function (words) {
      var lineEl = document.createElement('div');
      lineEl.className = 'line';
      words.forEach(function (w) {
        var sp = document.createElement('span');
        sp.className = 'w' + (w.hl ? ' hl' : '');
        sp.textContent = '';
        lineEl.appendChild(sp);
        seq.push({ text: w.text, el: sp, frag: fi, hl: w.hl });
      });
      // пауза «протяжки каретки» — только после последнего слова строки
      lineEnds[seq.length - 1] = true;
      verse.appendChild(lineEl);
    });

    var src = document.createElement('div');
    src.className = 'src';
    src.textContent = f.source || '';

    var card = document.createElement('div');
    card.className = 'card';
    var w = document.createElement('p');
    w.className = 'card__word';
    w.textContent = f.answer || '';
    var g = document.createElement('p');
    g.className = 'card__gloss';
    g.textContent = f.gloss || '';
    card.appendChild(w); card.appendChild(g);
    if (f.note) {
      var n = document.createElement('p');
      n.className = 'card__note';
      n.textContent = f.note;
      card.appendChild(n);
    }

    panel.appendChild(verse);
    panel.appendChild(src);
    panel.appendChild(card);

    fragStart.push(startIdx);
    fragEnd.push(seq.length - 1);
    frags.push({ index: fi, panel: panel, verseEl: verse, srcEl: src, cardEl: card, lineEnds: lineEnds, raw: f.text, size: f.size || 1, prose: f.text.indexOf('\n') === -1 });
  });

  /* ── подбор кегля: набираем отрывок целиком (временно, невидимо),
        подбираем размер, чтобы всё вошло в свою четверть, и закрепляем высоту,
        чтобы строки не «прыгали» во время печати ─────────────────── */
  function fillFull(fr, on) {
    for (var i = fragStart[fr.index]; i <= fragEnd[fr.index]; i++) {
      seq[i].el.textContent = on ? seq[i].text : '';
    }
  }

  function overflows(fr, fs, H) {
    fr.verseEl.style.fontSize = fs + 'px';
    var cs = window.getComputedStyle(fr.panel);
    var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var avail = fr.panel.clientHeight - pad - fr.srcEl.offsetHeight - 0.055 * H;
    if (fr.verseEl.offsetHeight > avail) return true;
    if (fr.prose) return false;                     // прозу переносить можно
    var oneLine = (parseFloat(window.getComputedStyle(fr.verseEl).lineHeight) || fs * 1.58);
    if (oneLine < fs) oneLine = fs * 1.58;
    var kids = fr.verseEl.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].offsetHeight > oneLine * 1.3) return true;   // строка перенеслась
    }
    return false;
  }

  function fitOne(fr) {
    var H = window.innerHeight, W = window.innerWidth;
    var lo = 13, hi = Math.max(20, Math.min(54, 0.019 * H + 0.011 * W)) * (fr.size || 1);
    fillFull(fr, true);
    if (!overflows(fr, hi, H)) {
      fr.verseEl.style.minHeight = fr.verseEl.offsetHeight + 'px';
      fillFull(fr, false);
      return;
    }
    for (var k = 0; k < 10; k++) {
      var mid = (lo + hi) / 2;
      if (overflows(fr, mid, H)) hi = mid; else lo = mid;
    }
    var fs = Math.floor(lo);
    fr.verseEl.style.fontSize = fs + 'px';
    fr.verseEl.style.minHeight = fr.verseEl.offsetHeight + 'px';
    fillFull(fr, false);
  }

  function fitCard(fr) {
    var H = fr.panel.clientHeight, lim = H * 0.62;
    var lo = 12, hi = Math.max(16, Math.min(26, 0.013 * H + 0.006 * window.innerWidth));
    var savedMax = fr.cardEl.style.maxHeight;
    fr.cardEl.style.maxHeight = 'none';
    fr.cardEl.style.visibility = 'hidden';
    fr.cardEl.style.fontSize = hi + 'px';
    if (fr.cardEl.offsetHeight <= lim) {
      fr.cardEl.style.visibility = '';
      fr.cardEl.style.maxHeight = savedMax;
      return;
    }
    for (var k = 0; k < 9; k++) {
      var mid = (lo + hi) / 2;
      fr.cardEl.style.fontSize = mid + 'px';
      if (fr.cardEl.offsetHeight > lim) hi = mid; else lo = mid;
    }
    fr.cardEl.style.fontSize = Math.floor(lo) + 'px';
    fr.cardEl.style.visibility = '';
    fr.cardEl.style.maxHeight = savedMax;
  }

  function layout() { frags.forEach(function (fr) { fitOne(fr); fitCard(fr); }); }
  var layoutTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(layout, 180);
  });
  layout();

  /* ── состояние ──────────────────────────────────────────────── */
  var wi = 0;             // текущее слово в seq
  var ci = 0;             // сколько знаков в нём уже напечатано
  var timer = null;
  var paused = false;
  var finished = false;
  var revealed = false;
  var currentFrag = -1;

  function speed() { return SPEEDS[speedIdx].ms; }

  function setPanelActive(fi) {
    if (currentFrag === fi) return;
    currentFrag = fi;
    frags.forEach(function (fr, i) { fr.panel.classList.toggle('active', i === fi); });
  }

  function render() {
    var it = seq[wi];
    it.el.textContent = it.text.slice(0, ci);
    it.el.parentNode.insertBefore(cursor, it.el.nextSibling);
  }

  function delayFor(item, isLineEnd, isFragEnd) {
    var k = speed() / SPEEDS[1].ms;
    var d;
    if (isFragEnd) d = P.frag;
    else if (isLineEnd) d = P.line;
    else {
      var t = item.text.replace(/\s+$/, '');
      var tail = t.slice(-1);
      if (/[—,]$/.test(tail)) d = P.comma * 0.8;
      else if (/[;:]$/.test(tail)) d = P.comma;
      else if (/[.?!…»]$/.test(tail)) d = P.end;
      else d = 0;
    }
    return d * k;
  }

  function step() {
    if (paused) return;
    var item = seq[wi];
    if (ci < item.text.length) {
      ci++;
      render();
      var base = speed() * (item.hl ? P.hl : 1);
      var jitter = 0.75 + Math.random() * 0.5;
      var extra = 0;
      var lastChar = item.text.charAt(ci - 1);
      if (/[—–]/.test(lastChar)) extra = base * 2;
      timer = setTimeout(step, base * jitter + extra);
      return;
    }

    var isLineEnd = !!frags[item.frag].lineEnds[wi];
    var isFragEnd = wi === fragEnd[item.frag];
    var wait = delayFor(item, isLineEnd, isFragEnd);

    if (isFragEnd) {
      frags[item.frag].panel.classList.remove('active');
      frags[item.frag].panel.classList.add('done');
      frags[item.frag].srcEl.classList.add('show');
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      wi++;
      ci = 0;
      if (wi >= seq.length) { finishAll(); return; }
      timer = setTimeout(function () { setPanelActive(seq[wi].frag); step(); }, wait);
      return;
    }

    wi++;
    ci = 0;
    if (wait > 0) timer = setTimeout(step, wait);
    else step();
  }

  function finishAll() {
    finished = true;
    if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
    btnReveal.disabled = false;
    brand.classList.add('brand--go');
    brandSub.innerHTML = BRAND_READY;
    showBar();
  }

  /* ── управление ─────────────────────────────────────────────── */
  function reset(startImmediately) {
    clearTimeout(timer);
    seq.forEach(function (it) { it.el.textContent = ''; });
    if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
    frags.forEach(function (fr) {
      fr.panel.classList.remove('active', 'done');
      fr.srcEl.classList.remove('show');
    });
    wi = 0; ci = 0; finished = false; currentFrag = -1;
    if (revealed) toggleReveal(false);
    brand.classList.remove('brand--go');
    brandSub.textContent = BRAND_DEFAULT;
    btnReveal.disabled = true;
    setPanelActive(0);
    btnPlay.textContent = 'Пауза';
    paused = false;
    if (startImmediately) timer = setTimeout(step, 350);
  }

  function togglePause(force) {
    paused = (typeof force === 'boolean') ? force : !paused;
    btnPlay.textContent = paused ? 'Продолжить' : 'Пауза';
    btnPlay.classList.toggle('bar__btn--on', paused);
    if (!paused && !finished && !timer) {
      // не было активного таймера — возобновляем
      timer = setTimeout(step, 250);
    } else if (paused) {
      clearTimeout(timer); timer = null;
    }
  }

  function fastForward() {
    if (finished) return;
    clearTimeout(timer); timer = null;
    var fi = seq[wi].frag;
    for (var i = fragStart[fi]; i <= fragEnd[fi]; i++) seq[i].el.textContent = seq[i].text;
    ci = 0;
    wi = fragEnd[fi];
    // добиваем хвост: ставим курсор в конец и завершаем фрагмент
    var it = seq[wi];
    it.el.parentNode.insertBefore(cursor, it.el.nextSibling);
    frags[fi].panel.classList.remove('active');
    frags[fi].panel.classList.add('done');
    frags[fi].srcEl.classList.add('show');
    if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
    wi = fragEnd[fi] + 1;
    if (wi >= seq.length) { finishAll(); return; }
    timer = setTimeout(function () { setPanelActive(seq[wi].frag); ci = 0; step(); }, 600);
  }

  function toggleReveal(force) {
    revealed = (typeof force === 'boolean') ? force : !revealed;
    document.body.classList.toggle('revealed', revealed);
    btnReveal.classList.toggle('bar__btn--on', revealed);
    btnReveal.textContent = revealed ? 'Скрыть пояснения' : 'Пояснения';
  }

  function cycleSpeed() {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    btnSpeed.textContent = 'Скорость: ' + SPEEDS[speedIdx].name;
  }

  /* хронометр: «кто быстрее» */
  var clockOn = false, clockT0 = 0, clockInt = null;
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' + m : m) + ':' + ((s % 60) < 10 ? '0' + (s % 60) : (s % 60));
  }
  function toggleClock() {
    clockOn = !clockOn;
    clockEl.hidden = !clockOn;
    btnClock.textContent = 'Хронометр: ' + (clockOn ? 'вкл' : 'выкл');
    btnClock.classList.toggle('bar__btn--on', clockOn);
    clearInterval(clockInt);
    if (clockOn) {
      clockT0 = Date.now();
      clockEl.textContent = '00:00';
      clockInt = setInterval(function () { clockEl.textContent = fmt(Date.now() - clockT0); }, 500);
    }
  }

  /* панели управления показываем, пока шевелишь мышью */
  var hideTimer = null;
  function showBar() {
    document.body.classList.add('showbar');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!bar.matches(':hover')) document.body.classList.remove('showbar');
    }, 3200);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); }
    else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen(); }
  }

  /* ── навешиваем события ─────────────────────────────────────── */
  btnPlay.addEventListener('click', function () { togglePause(); showBar(); });
  btnRestart.addEventListener('click', function () { reset(true); showBar(); });
  btnSpeed.addEventListener('click', function () { cycleSpeed(); showBar(); });
  btnReveal.addEventListener('click', function () { toggleReveal(); showBar(); });
  btnClock.addEventListener('click', function () { toggleClock(); showBar(); });
  btnFull.addEventListener('click', function () { toggleFullscreen(); showBar(); });
  btnSrc.addEventListener('click', function () {
    var off = document.body.classList.toggle('nosrc');
    btnSrc.textContent = 'Произведения: ' + (off ? 'нет' : 'да');
    btnSrc.classList.toggle('bar__btn--on', off);
    showBar();
  });

  document.addEventListener('mousemove', showBar);
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePause(); showBar(); }
    else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К' || e.key === 'Home') { reset(true); showBar(); }
    else if (e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М') { cycleSpeed(); showBar(); }
    else if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') { if (!btnReveal.disabled) { toggleReveal(); showBar(); } }
    else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') { toggleClock(); showBar(); }
    else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') { toggleFullscreen(); }
    else if (e.key === 'PageDown' || e.key === 'ArrowRight') { fastForward(); }
  });

  /* пульт (кликер) или клик по активной четверти — досказать/доскорить: допечатать отрывок целиком */
  stage.addEventListener('click', function (e) {
    var p = e.target.closest ? e.target.closest('.panel') : null;
    if (p && parseInt(p.getAttribute('data-index'), 10) === currentFrag) fastForward();
  });

  document.addEventListener('dblclick', function (e) {
    if (e.target.closest && e.target.closest('.bar')) return;
    toggleFullscreen();
  });

  btnSpeed.textContent = 'Скорость: ' + SPEEDS[speedIdx].name;

  /* ── старт: короткий отсчёт, чтобы все посмотрели на экран ──── */
  function begin() {
    setPanelActive(0);
    timer = setTimeout(step, 400);
  }

  if (countdown) {
    var n = 3;
    countdownNum.textContent = n;
    countdown.hidden = false;
    var iv = setInterval(function () {
      n--;
      if (n <= 0) { clearInterval(iv); countdown.hidden = true; begin(); return; }
      countdownNum.textContent = n;
    }, 900);
  } else {
    begin();
  }

  showBar();
})();
