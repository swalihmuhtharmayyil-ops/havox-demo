/* ==========================================================================
   Havox effects layer (vanilla JS, no dependencies).
   Effects: gradient waves, scroll text, scroll reveal, scroll float, gradient
   text, curved loop text, circular text, split text, elastic reel, expandable
   profile cards, bento, morphing button, liquid, glass morph, dynamic listing,
   dynamic grid, horizontal scroll, drag to explore, magnetic buttons,
   staggered scrolling, controlled parallax, parallax, page transitions,
   cursor with context.
   ========================================================================== */
(function () {
  'use strict';
  var d = document, root = d.documentElement, win = window;
  var reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = win.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('fx-ready');

  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function on(el, ev, fn, o) { if (el) el.addEventListener(ev, fn, o); }

  /* ---------------- shared scroll loop ---------------- */
  var S = { y: win.pageYOffset, vy: 0, vh: win.innerHeight, vw: win.innerWidth, t: 0 };
  var tickers = [];
  var measured = [];            // scroll-linked items measured once, never read in the loop
  function addTicker(fn) { tickers.push(fn); }
  var lastY = S.y;
  function frame(t) {
    S.t = t;
    S.y = win.pageYOffset;
    var dy = S.y - lastY; lastY = S.y;
    S.vy = lerp(S.vy, dy, 0.14);
    for (var i = 0; i < tickers.length; i++) tickers[i](t, S, dy);
    win.requestAnimationFrame(frame);
  }

  function measure() {
    S.vh = win.innerHeight; S.vw = win.innerWidth;
    measured.forEach(function (m) {
      m.el.style.translate = 'none';
      var r = m.el.getBoundingClientRect();
      m.top = r.top + win.pageYOffset; m.h = r.height;
    });
  }
  var mTimer;
  function remeasureSoon() { clearTimeout(mTimer); mTimer = setTimeout(function () { measure(); layoutAll(); }, 150); }

  /* ---------------- 3. scroll reveal  +  8. split text  +  count up ---------------- */
  function splitText(el) {
    if (el.__split) return; el.__split = true;
    var idx = 0;
    function walk(node, parent) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
            var w = d.createElement('span'); w.className = 'fx-word'; w.setAttribute('aria-hidden', 'true');
            part.split('').forEach(function (ch) {
              var c = d.createElement('span'); c.className = 'fx-char'; c.style.setProperty('--i', idx++); c.textContent = ch; w.appendChild(c);
            });
            frag.appendChild(w);
          });
          parent.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n, n);
      });
    }
    el.setAttribute('aria-label', el.textContent.trim());
    walk(el, el);
    el.classList.add('fx-split');
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')); if (isNaN(target)) return;
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce) { el.textContent = target + suffix; return; }
    var t0 = null, dur = 1600;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) win.requestAnimationFrame(step);
    }
    win.requestAnimationFrame(step);
  }

  function initReveal() {
    $$('[data-fx="split"]').forEach(splitText);
    var targets = $$('[data-fx="reveal"],[data-fx="split"],[data-count]');
    if (!('IntersectionObserver' in win)) { targets.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        if (en.target.hasAttribute('data-count')) countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (e) { io.observe(e); });
  }

  /* ---------------- 22 parallax, 4 scroll float, 21 controlled parallax, 20 staggered ---------------- */
  function initScrollLinked() {
    $$('[data-parallax]').forEach(function (el) { measured.push({ el: el, type: 'p', k: parseFloat(el.getAttribute('data-parallax')) || 0.15 }); });
    $$('[data-float]').forEach(function (el, i) { measured.push({ el: el, type: 'f', k: parseFloat(el.getAttribute('data-float')) || 0.08, ph: i * 1.7 }); });
    $$('[data-cparallax]').forEach(function (el) { measured.push({ el: el, type: 'c', k: parseFloat(el.getAttribute('data-cparallax')) || 7 }); });
    // staggered: existing program cards, offset by column parity
    var cards = $$('.capabilities-grid .capabilities-card');
    cards.forEach(function (el, i) { measured.push({ el: el, type: 's', k: 0.07, dir: (i % 2 === 0) ? 1 : -1 }); });
    measure();
    if (reduce) { measured.forEach(function (m) { m.el.style.translate = 'none'; }); return; }
    addTicker(function (t, s) {
      var mid = s.y + s.vh / 2;
      for (var i = 0; i < measured.length; i++) {
        var m = measured[i];
        var off = (m.top + m.h / 2) - mid;            // + below centre, - above
        if (off > s.vh * 1.4 || off < -s.vh * 1.4 - m.h) continue;
        var ty = 0, rot = 0;
        if (m.type === 'p') ty = -off * m.k;
        else if (m.type === 'f') { ty = -off * m.k + Math.sin(t / 1300 + m.ph) * 7; rot = Math.sin(t / 2100 + m.ph) * 0.8; }
        else if (m.type === 'c') { var p = clamp(off / (s.vh * 0.9), -1, 1); m.el.style.translate = '0 ' + (p * m.k).toFixed(2) + '%'; continue; }
        else if (m.type === 's') { ty = clamp(off * m.k * m.dir, -46, 46); }
        m.el.style.translate = '0 ' + ty.toFixed(1) + 'px';
        if (m.type === 'f') m.el.style.rotate = rot.toFixed(2) + 'deg';
      }
    });
  }

  /* ---------------- 1. gradient waves (hero canvas) ---------------- */
  function initWaves() {
    var hero = $('.section.hero'); if (!hero) return;
    var cv = d.createElement('canvas'); cv.className = 'fx-waves'; cv.setAttribute('aria-hidden', 'true');
    hero.insertBefore(cv, hero.firstChild);
    // lift existing hero children above the canvas without changing absolute ones
    Array.prototype.forEach.call(hero.children, function (c) {
      if (c === cv) return;
      if (win.getComputedStyle(c).position === 'static') { c.style.position = 'relative'; }
      c.style.zIndex = '1';
    });
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var w = 0, h = 0, dpr = Math.min(win.devicePixelRatio || 1, 1.5), vis = true, mx = 0.5, tmx = 0.5;
    function size() { var r = cv.getBoundingClientRect(); w = r.width; h = r.height; cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(S.t); }
    var layers = [
      { amp: 0.16, len: 1.1, sp: 0.00035, ph: 0.0, y: 0.50, a: 0.05, c: '26,26,26' },
      { amp: 0.14, len: 1.6, sp: -0.00028, ph: 1.7, y: 0.60, a: 0.06, c: '26,26,26' },
      { amp: 0.12, len: 0.9, sp: 0.00042, ph: 3.1, y: 0.70, a: 0.07, c: '60,60,60' },
      { amp: 0.10, len: 1.9, sp: -0.00022, ph: 4.4, y: 0.80, a: 0.09, c: '26,26,26' },
      { amp: 0.08, len: 1.3, sp: 0.00055, ph: 5.6, y: 0.90, a: 0.12, c: '0,0,0' }
    ];
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      mx = lerp(mx, tmx, 0.04);
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], baseY = h * L.y, amp = h * L.amp * (0.8 + mx * 0.5);
        var g = ctx.createLinearGradient(0, baseY - amp, 0, h);
        g.addColorStop(0, 'rgba(' + L.c + ',' + L.a + ')'); g.addColorStop(1, 'rgba(' + L.c + ',0)');
        ctx.beginPath(); ctx.moveTo(0, h);
        for (var x = 0; x <= w + 12; x += 12) {
          var u = x / w;
          var y = baseY + Math.sin(u * Math.PI * 2 * L.len + t * L.sp * 6 + L.ph) * amp * 0.55 + Math.sin(u * Math.PI * 2 * L.len * 2.1 - t * L.sp * 4 + L.ph) * amp * 0.25;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      }
    }
    on(win, 'resize', size);
    on(hero, 'pointermove', function (e) { var r = hero.getBoundingClientRect(); tmx = clamp((e.clientX - r.left) / r.width, 0, 1); });
    if ('IntersectionObserver' in win) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }, { threshold: 0 }).observe(hero);
    size();
    if (reduce) return;
    addTicker(function (t, s) { if (!vis) return; draw(t); cv.style.translate = '0 ' + (s.y * 0.12).toFixed(1) + 'px'; });
  }

  /* ---------------- 2. scroll text  (rows slide with scroll) ---------------- */
  var scrollRows = [];
  function initScrollText() {
    $$('.hx-scrolltext-row').forEach(function (row) {
      var html = row.innerHTML; row.innerHTML = html + html + html + html;
      scrollRows.push({ el: row, dir: parseFloat(row.getAttribute('data-dir')) || 1, unit: 0 });
    });
    function m() { scrollRows.forEach(function (r) { r.unit = r.el.scrollWidth / 4; }); }
    m(); on(win, 'resize', m); on(win, 'load', m);
    if (reduce) return;
    var x = 0;
    addTicker(function (t, s) {
      x = s.y * 0.45;
      scrollRows.forEach(function (r) {
        if (!r.unit) return;
        var p = ((x * r.dir) % r.unit + r.unit) % r.unit;     // 0..unit
        r.el.style.translate = (-r.unit + p * (r.dir > 0 ? 1 : 1)) + 'px 0';
      });
    });
  }

  /* ---------------- 9. elastic reel + 17. drag to explore ---------------- */
  function initReel() {
    var reel = $('.hx-reel'); if (!reel) return;
    var track = $('.hx-reel-track', reel);
    var html = track.innerHTML; track.innerHTML = html + html + html;
    var half = 0, x = 0, v = 0, skew = 0, dragging = false, lx = 0, vis = true;
    function m() { half = track.scrollWidth / 3; }
    m(); on(win, 'resize', m); on(win, 'load', m);
    on(reel, 'pointerdown', function (e) { dragging = true; lx = e.clientX; reel.classList.add('is-dragging'); try { reel.setPointerCapture(e.pointerId); } catch (_) {} });
    on(reel, 'pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; x += dx; v = dx; });
    function up() { dragging = false; reel.classList.remove('is-dragging'); }
    on(reel, 'pointerup', up); on(reel, 'pointercancel', up); on(reel, 'pointerleave', up);
    if ('IntersectionObserver' in win) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }, { threshold: 0 }).observe(reel);
    if (reduce) return;
    addTicker(function (t, s) {
      if (!vis) return;
      if (!dragging) { v = lerp(v, -1.1 - s.vy * 0.9, 0.06); x += v; }
      if (x <= -half) x += half; if (x > 0) x -= half;
      skew = lerp(skew, clamp(v * 0.7, -14, 14), 0.12);
      track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0) skewX(' + (-skew).toFixed(2) + 'deg)';
    });
  }

  /* ---------------- 6. curved loop text ---------------- */
  function initCurve() {
    var tp = $('#hx-curve-text'); if (!tp) return;
    var unit = 0, off = 0;
    function m() { var n = parseInt(tp.getAttribute('data-repeat'), 10) || 6; unit = tp.getComputedTextLength() / n; }
    m(); on(win, 'load', m);
    if (reduce) return;
    addTicker(function (t, s) {
      if (!unit) { m(); return; }
      off -= 0.55 + Math.abs(s.vy) * 0.35 * (s.vy >= 0 ? 1 : -1);
      off = ((off % unit) + unit) % unit - unit;
      tp.setAttribute('startOffset', off.toFixed(1));
    });
  }

  /* ---------------- 7. circular text  (ring spin picks up scroll speed) ---------------- */
  function initRings() {
    var rings = $$('.hx-ring'); if (!rings.length || reduce) return;
    addTicker(function (t, s) { rings.forEach(function (r) { r.style.rotate = (s.y * 0.12).toFixed(1) + 'deg'; }); });
  }

  /* ---------------- 10. expandable profile cards ---------------- */
  function initProfiles() {
    var wrap = $('.hx-profiles'); if (!wrap) return;
    var cards = $$('.hx-profile', wrap), timer;
    function activate(c) { cards.forEach(function (x) { var a = x === c; x.classList.toggle('is-active', a); x.setAttribute('aria-expanded', a ? 'true' : 'false'); }); }
    cards.forEach(function (c) {
      c.setAttribute('tabindex', '0'); c.setAttribute('role', 'group');
      on(c, 'click', function () { if (!c.classList.contains('is-active')) activate(c); });
      on(c, 'focus', function () { activate(c); });
      on(c, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { if (e.target === c) { e.preventDefault(); activate(c); } } });
      if (fine) {
        on(c, 'mouseenter', function () { clearTimeout(timer); timer = setTimeout(function () { activate(c); }, 140); });
        on(c, 'mouseleave', function () { clearTimeout(timer); });
      }
    });
    activate(cards[0]);
  }

  /* ---------------- 13 liquid + 14 glass (pointer light, follow blob) ---------------- */
  function initLiquid() {
    var sec = $('#achievements-section'); if (!sec) return;
    $$('.hx-tile', sec).forEach(function (t) {
      on(t, 'pointermove', function (e) { var r = t.getBoundingClientRect(); t.style.setProperty('--gx', (e.clientX - r.left) + 'px'); t.style.setProperty('--gy', (e.clientY - r.top) + 'px'); });
    });
    var blob = $('.hx-blob.follow', sec); if (!blob || reduce) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, vis = false;
    on(sec, 'pointermove', function (e) { var r = sec.getBoundingClientRect(); tx = e.clientX - r.left - 75; ty = e.clientY - r.top - 75; });
    if ('IntersectionObserver' in win) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }, { threshold: 0 }).observe(sec);
    addTicker(function () { if (!vis) return; cx = lerp(cx, tx, 0.07); cy = lerp(cy, ty, 0.07); blob.style.translate = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px'; });
  }

  /* ---------------- 18 horizontal scroll  +  17 drag to explore ---------------- */
  var hs = null;
  function initHScroll() {
    var sec = $('.hx-hscroll'); if (!sec) return;
    var track = $('.hx-hs-track', sec), view = $('.hx-hs-viewport', sec), bar = $('.hx-hs-progress span', sec), sticky = $('.hx-hscroll-sticky', sec);
    hs = { sec: sec, track: track, view: view, bar: bar, sticky: sticky, travel: 0, top: 0, range: 1, native: false, p: 0, target: 0 };
    function layout() {
      sec.classList.remove('is-native'); sec.style.height = ''; track.style.translate = 'none';
      var native = S.vw < 900 || !fine || reduce;
      hs.native = native;
      if (native) { sec.classList.add('is-native'); return; }
      hs.travel = Math.max(0, track.scrollWidth - S.vw + 40);
      sec.style.height = (S.vh + hs.travel) + 'px';
      hs.top = sec.getBoundingClientRect().top + win.pageYOffset;
      hs.range = hs.travel;
    }
    hs.layout = layout; layout();
    addTicker(function (t, s) {
      if (hs.native) return;
      var p = clamp((s.y - hs.top) / hs.range, 0, 1);
      hs.p = lerp(hs.p, p, 0.14);
      track.style.translate = (-hs.p * hs.travel).toFixed(1) + 'px 0';
      if (bar) bar.parentNode.style.setProperty('--p', hs.p.toFixed(3));
    });
    // drag to explore
    var down = false, lx = 0;
    on(view, 'pointerdown', function (e) { if (e.pointerType === 'touch') return; down = true; lx = e.clientX; view.style.cursor = 'grabbing'; try { view.setPointerCapture(e.pointerId); } catch (_) {} });
    on(view, 'pointermove', function (e) {
      if (!down) return; var dx = e.clientX - lx; lx = e.clientX;
      if (hs.native) view.scrollLeft -= dx; else win.scrollBy(0, -dx);   // moving the page moves the rail
    });
    function up() { down = false; view.style.cursor = ''; }
    on(view, 'pointerup', up); on(view, 'pointercancel', up);
  }

  /* ---------------- 15 dynamic listing  +  16 dynamic grid (FLIP) ---------------- */
  function initProjects() {
    var box = $('.hx-projects'); if (!box) return;
    var items = $$('.hx-project', box), filter = 'All';
    function rects() { return items.map(function (el) { return el.hidden ? null : el.getBoundingClientRect(); }); }
    function flip(mutate) {
      var before = rects(); mutate(); var after = rects();
      if (reduce || !Element.prototype.animate) return;
      items.forEach(function (el, i) {
        var b = before[i], a = after[i];
        if (!a) return;
        if (!b) { el.animate([{ opacity: 0, transform: 'scale(.92) translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', delay: i * 18 }); return; }
        var dx = b.left - a.left, dy = b.top - a.top, sx = b.width / a.width, sy = b.height / a.height;
        if (!dx && !dy && sx === 1 && sy === 1) return;
        el.animate([{ transformOrigin: '0 0', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    }
    function apply() {
      var n = 0;
      items.forEach(function (el) {
        var show = filter === 'All' || el.getAttribute('data-cat') === filter;
        el.hidden = !show;
        if (show) { n++; var ix = $('.hx-project-index', el); if (ix) ix.textContent = (n < 10 ? '0' : '') + n; }
      });
      var c = $('.hx-projects-count', box); if (c) c.textContent = n + (n === 1 ? ' project' : ' projects');
    }
    $$('[data-filter]', box).forEach(function (b) {
      on(b, 'click', function () {
        filter = b.getAttribute('data-filter');
        $$('[data-filter]', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        flip(apply);
      });
    });
    $$('[data-viewbtn]', box).forEach(function (b) {
      on(b, 'click', function () {
        var v = b.getAttribute('data-viewbtn');
        $$('[data-viewbtn]', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        flip(function () { box.setAttribute('data-view', v); });
      });
    });
    apply();
  }

  /* ---------------- 19 magnetic buttons ---------------- */
  function initMagnetic() {
    if (!fine || reduce) return;
    var els = $$('.button, .hx-btn, .submit-button, .form-button, .navbar .button-wrap, .hx-pill, .hx-profile .hx-chip');
    els.forEach(function (el) {
      var strength = el.classList.contains('hx-pill') || el.classList.contains('hx-chip') ? 0.18 : 0.32;
      on(el, 'pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * strength, y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transition = 'translate .15s ease-out'; el.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      });
      on(el, 'pointerleave', function () { el.style.transition = 'translate .7s cubic-bezier(.2,1.6,.4,1)'; el.style.translate = '0 0'; });
    });
  }

  /* ---------------- 24 cursor with context ---------------- */
  function initCursor() {
    if (!fine || reduce) return;
    var dot = d.createElement('div'), ring = d.createElement('div'), label = d.createElement('span');
    dot.className = 'fx-cursor'; ring.className = 'fx-cursor-ring'; ring.appendChild(label);
    d.body.appendChild(dot); d.body.appendChild(ring);
    var x = -100, y = -100, rx = -100, ry = -100;
    on(d, 'pointermove', function (e) { x = e.clientX; y = e.clientY; root.classList.add('fx-cursor-on'); });
    on(d.documentElement, 'mouseleave', function () { root.classList.remove('fx-cursor-on'); });
    on(d.documentElement, 'mouseenter', function () { root.classList.add('fx-cursor-on'); });
    on(d, 'pointerdown', function () { ring.classList.add('is-down'); });
    on(d, 'pointerup', function () { ring.classList.remove('is-down'); });
    var rules = [
      ['[data-cursor]', function (el) { return el.getAttribute('data-cursor'); }],
      ['.hx-profile:not(.is-active)', function () { return 'Expand'; }],
      ['.hx-project a', function () { return 'Visit'; }],
      ['.hx-btn, .hx-portfolio-link', function () { return 'Open'; }],
      ['.hx-tile', function () { return ''; }]
    ];
    function context(t) {
      if (t.closest('input,textarea,select')) { root.classList.add('fx-cursor-hide'); return; }
      root.classList.remove('fx-cursor-hide');
      var text = null;
      for (var i = 0; i < rules.length; i++) { var el = t.closest(rules[i][0]); if (el) { text = rules[i][1](el); if (text) break; } }
      var link = !!t.closest('a,button,[role="button"],.button,.w-nav-link,summary,[data-filter],[data-viewbtn]');
      if (text) { label.textContent = text; ring.classList.add('has-label'); ring.classList.remove('is-link'); }
      else { ring.classList.remove('has-label'); ring.classList.toggle('is-link', link); }
    }
    on(d, 'pointerover', function (e) { context(e.target); });
    addTicker(function () {
      rx = lerp(rx, x, 0.2); ry = lerp(ry, y, 0.2);
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    });
  }

  /* ---------------- 23 page transitions ---------------- */
  function initTransitions() {
    if (reduce) return;
    var c = d.createElement('div'); c.className = 'fx-curtain no-anim'; c.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 5; i++) { var b = d.createElement('i'); b.style.setProperty('--n', i); c.appendChild(b); }
    var logo = d.createElement('b'); logo.textContent = 'Havox'; c.appendChild(logo);
    d.body.appendChild(c);
    function reset() { c.classList.add('no-anim'); c.classList.remove('is-in', 'is-out', 'is-active'); void c.offsetWidth; }
    function cover(cb) {
      c.classList.add('is-active'); c.classList.remove('no-anim', 'is-out'); void c.offsetWidth; c.classList.add('is-in');
      setTimeout(cb, 720);
    }
    function uncover() {
      c.classList.add('is-active'); c.classList.remove('no-anim'); void c.offsetWidth;
      c.classList.remove('is-in'); c.classList.add('is-out');
      setTimeout(reset, 950);
    }
    // arriving via an internal navigation: start covered, then lift
    var arrived = false; try { arrived = sessionStorage.getItem('fx-nav') === '1'; sessionStorage.removeItem('fx-nav'); } catch (_) {}
    if (arrived) { c.classList.add('is-active', 'is-in'); void c.offsetWidth; setTimeout(uncover, 80); }
    on(win, 'pageshow', function (e) { if (e.persisted) reset(); });
    var busy = false;
    on(d, 'click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || busy) return;
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      if (a.target && a.target !== '_self') return; if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      var url; try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      var samePage = url.pathname === location.pathname && url.search === location.search;
      if (samePage) {
        if (!url.hash || url.hash === '#') return;
        var tgt = d.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (!tgt || a.closest('[data-w-tab],.w-tab-link,[role="tab"]')) return;
        e.preventDefault(); busy = true;
        cover(function () {
          var prev = root.style.scrollBehavior; root.style.scrollBehavior = 'auto';
          tgt.scrollIntoView(); history.pushState(null, '', url.hash);
          root.style.scrollBehavior = prev; uncover(); setTimeout(function () { busy = false; }, 900);
        });
        return;
      }
      e.preventDefault(); busy = true;
      try { sessionStorage.setItem('fx-nav', '1'); } catch (_) {}
      cover(function () { location.href = a.href; });
    });
  }

  /* ---------------- init ---------------- */
  function layoutAll() { if (hs && hs.layout) hs.layout(); }
  function init() {
    initWaves();
    initReveal();
    initScrollText();
    initReel();
    initCurve();
    initRings();
    initProfiles();
    initLiquid();
    initProjects();
    initScrollLinked();
    initHScroll();
    initMagnetic();
    initCursor();
    initTransitions();
    on(win, 'resize', remeasureSoon);
    on(win, 'load', function () { setTimeout(function () { measure(); layoutAll(); }, 400); });
    if ('ResizeObserver' in win) { var ro = new ResizeObserver(remeasureSoon); ro.observe(d.body); }
    win.requestAnimationFrame(frame);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
