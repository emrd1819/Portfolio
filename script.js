/* ==========================================================
   0. SETTINGS (change these)
   ========================================================== */
var AUTOPLAY = true;              // the folio flips pages by itself (visitors can pause it)
var PAGE_SECONDS = 8;             // time spent on each page
var SCROLL_SPEED = 55;            // long pages scroll by themselves (pixels per second)
var LOADING_MS = 2600;            // how long the loading screen lasts
var STARS = true;                 // the interactive starfield in the background
var LOADING_MESSAGES = ['[warming up the pages]', '[polishing the details]', '[adding a touch of gold]', '[almost there]'];
var SPARK_MESSAGES = ['[hello!]', '[nice to meet you]', '[psst, try Ctrl+K]'];   // click the little star on page 1
var CERT_COUNT_TEXT = 'Showing {n} of {total}';   // text above the certificate filters
var COPIED_TEXT = 'Email copied';                 // message after "Copy email"
var MAIL_SUBJECT = 'Hello from {name}';           // subject line of the message form
var SHARE_TITLE = 'Ella Mae Dolon | Portfolio';   // used by the Share button
var SHARE_TEXT = 'Take a look at my portfolio';
var CONFETTI_COLORS = ['#ffc933', '#f2b705', '#0e7c86', '#14181f', '#fffdf8'];

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
var coarse = window.matchMedia('(pointer: coarse)').matches;
if (reduceMotion) { AUTOPLAY = false; LOADING_MS = 600; }

function $(id) { return document.getElementById(id); }
function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
function pad(n) { return ('0' + n).slice(-2); }

// Builds an icon from the sprite in index.html, e.g. icon('mail')
function icon(name) {
  return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

var toastTimer;
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

// A tiny vibration on phones that support it
function haptic(ms) {
  if (reduceMotion || !navigator.vibrate) return;
  try { navigator.vibrate(ms || 8); } catch (e) {}
}

// Confetti: circles, squares, and thin ribbons in the theme colors
function confetti(x, y, count) {
  if (reduceMotion) return;
  for (var i = 0; i < (count || 22); i++) {
    var s = document.createElement('span');
    var size = 6 + Math.random() * 7;
    var shape = i % 3;
    s.className = 'pop';
    s.style.width = (shape === 2 ? size * 0.4 : size) + 'px';
    s.style.height = (shape === 2 ? size * 1.8 : size) + 'px';
    s.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    if (shape === 0) s.style.borderRadius = '50%';
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--dx', (Math.random() * 20 - 10) + 'rem');
    s.style.setProperty('--dy', (-4 - Math.random() * 9) + 'rem');
    s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    s.style.animationDelay = (Math.random() * 0.12) + 's';
    document.body.appendChild(s);
    setTimeout(function (el) { el.remove(); }, 1800, s);
  }
}

function burst(el, count) {
  var r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, count);
}


/* ==========================================================
   1. STATE
   ========================================================== */
var pages = $$('.page');
var scrollers = pages.map(function (p) { return p.querySelector('.scroll'); });
var tabsBox = $('tabs');
var sheets = $('sheets');
var curl = $('curl');
var palette = $('palette');
var caseDlg = $('case');
var current = 0;
var entered = false;
var hintDismissed = false;

var playing = AUTOPLAY;
var holding = false;          // true while a finger or mouse is pressed on the page
var elapsed = 0;              // milliseconds spent on the current page
var duration = PAGE_SECONDS * 1000;
var expectedTop = 0;          // where the automatic scroll last put the page

// true while the command menu or a case study pop-up is open
function modalOpen() { return palette.open || caseDlg.open; }


/* ==========================================================
   2. PAGES AND TABS
   ========================================================== */
pages.forEach(function (page, i) {
  // each page's web address ending, e.g. "Projects" -> #projects
  page.dataset.slug = page.dataset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  var tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'tab';
  tab.innerHTML = icon(page.dataset.icon);
  tab.title = page.dataset.title;
  tab.setAttribute('aria-label', page.dataset.title);
  tab.addEventListener('click', function () { go(i); });
  tabsBox.appendChild(tab);
});

// Long pages get more time, so there is room to scroll through them
function pageDuration(i) {
  var s = scrollers[i];
  var overflow = Math.max(0, s.scrollHeight - s.clientHeight);
  return (PAGE_SECONDS + overflow / SCROLL_SPEED) * 1000;
}

function paintPlay() {
  $('play').innerHTML = icon(playing ? 'pause' : 'play');
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('play').title = playing ? 'Pause' : 'Play';
}

// how = 'silent' (no address change), 'auto' (by the timer), or nothing (visitor's choice)
function go(i, how) {
  i = Math.max(0, Math.min(pages.length - 1, i));
  var last = pages.length - 1;
  current = i;
  elapsed = 0;

  // pages already turned swing away, the next page waits underneath
  pages.forEach(function (page, n) {
    page.classList.toggle('turned', n < i);
    page.classList.toggle('active', n === i);
    page.classList.toggle('behind', n === i + 1);
    page.classList.toggle('far', n > i + 1);
    page.inert = n !== i;
  });

  expectedTop = 0;
  scrollers[i].scrollTop = 0;
  duration = pageDuration(i);

  [].forEach.call(tabsBox.children, function (tab, n) {
    tab.classList.toggle('active', n === i);
    tab.style.setProperty('--p', 0);
    if (n === i) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });

  if (i > 0) hintDismissed = true;
  $('hint').classList.toggle('gone', hintDismissed);
  curl.hidden = i === last;

  $('now-title').textContent = pages[i].dataset.title;
  $('count').textContent = pad(i + 1) + ' / ' + pad(pages.length);
  $('next').disabled = i === last;
  runCounters(pages[i]);
  if (how !== 'silent' && how !== 'auto') haptic(8);

  // celebrate reaching the last page
  if (i === last && entered && how !== 'silent') setTimeout(function () { burst($('sheets'), 30); }, 500);

  // keep the web address in step, so the back button and shared links work
  if (entered && how !== 'silent') {
    var hash = '#' + pages[i].dataset.slug;
    if (location.hash !== hash) {
      try {
        if (how === 'auto') history.replaceState(null, '', hash);
        else history.pushState(null, '', hash);
      } catch (e) {}
    }
  }
}

function goSlug(slug, how) {
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].dataset.slug === slug) { go(i, how); return true; }
  }
  return false;
}


/* ==========================================================
   3. DRAG THE CORNER TO TURN THE PAGE LIKE A REAL ONE
   ========================================================== */
var drag = null;

curl.addEventListener('pointerdown', function (e) {
  if (current >= pages.length - 1 || !entered) return;
  drag = { page: pages[current], startX: e.clientX, moved: false, angle: 0 };
  curl.setPointerCapture(e.pointerId);
  drag.page.classList.add('dragging');
  holding = true;
  hintDismissed = true;
  $('hint').classList.add('gone');
});

curl.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var box = sheets.getBoundingClientRect();
  var u = Math.max(-1, Math.min(1, (e.clientX - box.left) / box.width));
  drag.angle = -Math.acos(u) * 180 / Math.PI;
  if (Math.abs(e.clientX - drag.startX) > 5) drag.moved = true;
  drag.page.style.setProperty('--ry', drag.angle.toFixed(1));
});

function endDrag() {
  if (!drag) return;
  var d = drag;
  drag = null;
  holding = false;
  d.page.classList.remove('dragging');
  d.page.style.removeProperty('--ry');
  // a simple click, or a drag past the middle, flips the page
  if (!d.moved || d.angle < -60) go(current + 1);
}

curl.addEventListener('pointerup', endDrag);
curl.addEventListener('pointercancel', endDrag);

// Keyboard users press Enter on the corner
curl.addEventListener('click', function (e) {
  if (e.detail === 0 && current < pages.length - 1) go(current + 1);
});


/* ==========================================================
   4. THE EXTRAS: headline reveals, card tilt, magnetic buttons,
      starfield, command menu, case studies, local time, sharing
   ========================================================== */

// Headlines: split into words so each one can slide up (the full text stays readable to screen readers)
$$('[data-split]').forEach(function (el) {
  var text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  text.split(/\s+/).forEach(function (word, i) {
    var outer = document.createElement('span');
    var inner = document.createElement('span');
    outer.className = 'w';
    outer.setAttribute('aria-hidden', 'true');
    inner.textContent = word;
    inner.style.setProperty('--i', i);
    outer.appendChild(inner);
    el.appendChild(outer);
    el.appendChild(document.createTextNode(' '));
  });
});

if (fineHover && !reduceMotion) {
  // Cards tilt a little toward the pointer
  $$('.card, .award, .stat, .cert').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--tilt-y', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(2));
      el.style.setProperty('--tilt-x', ((0.5 - (e.clientY - r.top) / r.height) * 7).toFixed(2));
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--tilt-x', 0);
      el.style.setProperty('--tilt-y', 0);
    });
  });

  // Buttons lean toward the pointer
  $$('.btn, .tab, .ctrls button').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--bx', ((e.clientX - r.left - r.width / 2) * 0.2).toFixed(1) + 'px');
      el.style.setProperty('--by', ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--bx', '0px');
      el.style.setProperty('--by', '0px');
    });
  });
}

// The interactive starfield: dots drift, link up when close, and gather around your pointer or finger
(function starfield() {
  var cv = $('stars');
  if (!cv || !STARS || reduceMotion) return;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var pts = [], w = 0, h = 0, rgb = '138,95,0';
  var mouse = { x: -9999, y: -9999 };

  function readColor() {
    rgb = getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim() || rgb;
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(90, (w * h) / 15000) * (coarse ? 0.6 : 1));
    pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, r: 0.8 + Math.random() * 1.6 });
    }
  }

  function draw() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 170) { p.vx += dx / d * 0.006; p.vy += dy / d * 0.006; }
        p.vx *= 0.995; p.vy *= 0.995;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
        ctx.fillStyle = 'rgba(' + rgb + ',0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], ex = p.x - q.x, ey = p.y - q.y, e = ex * ex + ey * ey;
          if (e < 14400) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.2 * (1 - e / 14400)).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        if (d < 150) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.35 * (1 - d / 150)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
  window.addEventListener('resize', resize);
  new MutationObserver(readColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColor);
  readColor();
  resize();
  draw();
})();

// Greeting and local time ("Good evening / Polangui 9:41 PM")
function updateTime() {
  var hour = new Date().getHours();
  $('greeting').textContent = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  var el = $('localtime');
  try {
    var t = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', timeZone: el.dataset.tz }).format(new Date());
    el.textContent = el.dataset.city + ' \u00b7 ' + t;
  } catch (err) {
    el.textContent = el.dataset.city;
  }
}
updateTime();
setInterval(updateTime, 30000);

// Share: the phone's share sheet where available, otherwise copy the link
function sharePage() {
  var data = { title: SHARE_TITLE, text: SHARE_TEXT, url: location.href.split('#')[0] };
  if (navigator.share) {
    navigator.share(data).catch(function () {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data.url).then(function () { toast('Link copied'); }, function () { toast(data.url); });
  } else {
    toast(data.url);
  }
}
$('share-btn').addEventListener('click', sharePage);

// The little star next to your name
var sparkCount = 0;
$('spark').addEventListener('click', function () {
  var star = $('spark');
  star.classList.remove('boing');
  void star.getBoundingClientRect();
  star.classList.add('boing');
  burst(star, 26);
  haptic(12);
  toast(SPARK_MESSAGES[sparkCount++ % SPARK_MESSAGES.length]);
  setTimeout(function () { star.classList.remove('boing'); }, 900);
});

// Project case studies open in a pop-up built from the card you click
$$('.project .more-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var card = btn.closest('.project');
    var box = $('case-content');
    var body = document.createElement('div');
    var pick = function (sel) { var n = card.querySelector(sel); return n ? n.cloneNode(true) : null; };
    box.textContent = '';
    var shot = pick('.shot');
    if (shot) box.appendChild(shot);
    body.className = 'case-body';
    [pick('.tag'), pick('h3'), pick('.card-body > p:not(.tag):not(.links)')].forEach(function (n) { if (n) body.appendChild(n); });
    var more = pick('.more');
    if (more) { more.hidden = false; body.appendChild(more); }
    [pick('.chips'), pick('.links')].forEach(function (n) {
      if (!n) return;
      var b = n.querySelector('.more-btn');
      if (b) b.remove();
      body.appendChild(n);
    });
    box.appendChild(body);
    caseDlg.showModal();
  });
});
$('case-close').addEventListener('click', function () { caseDlg.close(); });
caseDlg.addEventListener('click', function (e) { if (e.target === caseDlg) caseDlg.close(); });

// Organization: click it to see your membership ID
function mk(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}


$$('.org-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {

    var box = $('case-content');
    var body = mk('div', 'case-body');

    box.textContent = '';

    // Organization information
    body.appendChild(mk('p', 'tag', 'Organization'));
    body.appendChild(mk('h3', '', btn.dataset.org));
    body.appendChild(
      mk('p', '', 'Role: ' + btn.dataset.role)
    );

    // Membership card photo
    if (btn.dataset.img) {
      var pic = mk('img', 'org-pic');

      pic.src = btn.dataset.img;
      pic.alt = 'FGWB PH Membership Card';
      pic.loading = 'lazy';

      pic.onerror = function () {
        pic.remove();
        body.appendChild(
          mk('p', 'muted', 'Membership card image unavailable.')
        );
      };

      body.appendChild(pic);
    }

    box.appendChild(body);

    // Open existing modal
    caseDlg.showModal();
  });
});


// Command menu: Ctrl+K (Cmd+K on a Mac), the / key, or the Search button
var palInput = $('pal-input');
var palList = $('pal-list');
var palItems = [];
var palIndex = 0;

$('kbd-hint').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '\u2318 K' : 'Ctrl K';

function getCommands() {
  var cmds = pages.map(function (p, i) {
    return { label: 'Go to ' + p.dataset.title, hint: 'Page ' + pad(i + 1), icon: p.dataset.icon, run: function () { go(i); } };
  });
  cmds.push({ label: playing ? 'Pause auto-flip' : 'Play auto-flip', hint: 'Space', icon: playing ? 'pause' : 'play', run: togglePlay });
  cmds.push({ label: isDark() ? 'Switch to day theme' : 'Switch to night theme', hint: 'Theme', icon: isDark() ? 'sun' : 'moon', run: function () { themeBtn.click(); } });
  cmds.push({ label: 'Copy email address', hint: 'Contact', icon: 'copy', run: function () { $('copy-email').click(); } });
  var resume = document.querySelector('a[download]');
  if (resume) cmds.push({ label: 'Download r\u00e9sum\u00e9', hint: 'File', icon: 'download', run: function () { resume.click(); } });
  cmds.push({ label: 'Share this portfolio', hint: 'Share', icon: 'share', run: sharePage });
  $$('[data-cmd]').forEach(function (a) {
    cmds.push({ label: 'Open ' + a.dataset.cmd, hint: 'Link', icon: 'external', run: function () { window.open(a.href, '_blank', 'noopener'); } });
  });
  return cmds;
}

// Simple fuzzy match: a direct hit scores highest, letters in order score lower
function score(query, text) {
  query = query.toLowerCase();
  text = text.toLowerCase();
  if (!query) return 1;
  var at = text.indexOf(query);
  if (at > -1) return 100 - at;
  var qi = 0;
  for (var k = 0; k < text.length && qi < query.length; k++) if (text[k] === query[qi]) qi++;
  return qi === query.length ? 1 : 0;
}

function setPal(i) {
  palIndex = i;
  $$('.pal-item', palList).forEach(function (li, n) { li.setAttribute('aria-selected', n === i); });
  var li = palList.children[i];
  if (li && li.id) {
    palInput.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView({ block: 'nearest' });
  }
}

function runPal(i) {
  var cmd = palItems[i];
  if (!cmd) return;
  palette.close();
  setTimeout(cmd.run, 80);
}

function renderPalette(query) {
  palItems = getCommands()
    .map(function (c) { return { c: c, s: score(query.trim(), c.label + ' ' + c.hint) }; })
    .filter(function (x) { return x.s > 0; })
    .sort(function (a, b) { return b.s - a.s; })
    .map(function (x) { return x.c; });
  palList.textContent = '';
  if (!palItems.length) {
    var empty = document.createElement('li');
    empty.className = 'pal-empty';
    empty.textContent = 'No results';
    palList.appendChild(empty);
    return;
  }
  palItems.forEach(function (c, i) {
    var li = document.createElement('li');
    li.className = 'pal-item';
    li.id = 'pal-opt-' + i;
    li.setAttribute('role', 'option');
    li.innerHTML = icon(c.icon) + '<span class="lbl"></span><span class="hnt"></span>';
    li.querySelector('.lbl').textContent = c.label;
    li.querySelector('.hnt').textContent = c.hint;
    li.addEventListener('click', function () { runPal(i); });
    li.addEventListener('pointermove', function () { if (palIndex !== i) setPal(i); });
    palList.appendChild(li);
  });
  setPal(0);
}

function openPalette() {
  if (palette.open) return;
  palette.showModal();
  palInput.value = '';
  renderPalette('');
  palInput.focus();
}

$('open-palette').addEventListener('click', openPalette);
palInput.addEventListener('input', function () { renderPalette(palInput.value); });
palInput.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); setPal(Math.min(palItems.length - 1, palIndex + 1)); }
  if (e.key === 'ArrowUp') { e.preventDefault(); setPal(Math.max(0, palIndex - 1)); }
  if (e.key === 'Enter') { e.preventDefault(); runPal(palIndex); }
});
palette.addEventListener('click', function (e) { if (e.target === palette) palette.close(); });

document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  var typing = tag === 'input' || tag === 'textarea';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (entered) openPalette(); }
  else if (e.key === '/' && !typing && entered && !modalOpen()) { e.preventDefault(); openPalette(); }
});


/* ==========================================================
   5. AUTO-FLIP: timer, auto-scroll, and the player buttons
   ========================================================== */
var lastTime = performance.now();

function frame(now) {
  var dt = Math.min(100, now - lastTime);
  lastTime = now;

  if (entered && playing && !holding && $('lightbox').hidden && !modalOpen() && !document.hidden) {
    elapsed += dt;
    var p = Math.min(1, elapsed / duration);

    // long pages: rest at the top, scroll down smoothly, rest at the bottom
    var s = scrollers[current];
    var overflow = s.scrollHeight - s.clientHeight;
    if (overflow > 0 && !reduceMotion) {
      var t = Math.min(1, Math.max(0, (p - 0.2) / 0.65));
      expectedTop = overflow * t;
      s.scrollTop = expectedTop;
    }

    tabsBox.children[current].style.setProperty('--p', p.toFixed(3));

    if (elapsed >= duration) {
      if (current < pages.length - 1) {
        go(current + 1, 'auto');
      } else {
        playing = false;          // reached the last page
        paintPlay();
      }
    }
  }
  requestAnimationFrame(frame);
}

// If a visitor scrolls a page by hand, autoplay pauses so they can read in peace
scrollers.forEach(function (s, n) {
  s.addEventListener('scroll', function () {
    if (!entered || n !== current) return;
    if (Math.abs(s.scrollTop - expectedTop) > 2 && playing) {
      playing = false;
      paintPlay();
    }
  });
});

// Pressing and holding on a page also pauses it while held
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
  sheets.addEventListener(type, function () { if (!drag) holding = false; });
});
sheets.addEventListener('pointerdown', function (e) {
  if (!e.target.closest('.curl')) holding = true;
});

// Typing in the message form pauses autoplay too
document.addEventListener('focusin', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if ((tag === 'input' || tag === 'textarea') && playing) { playing = false; paintPlay(); }
});

function togglePlay() {
  var last = pages.length - 1;
  if (!playing && current === last && elapsed >= duration) {
    go(0, 'auto');                     // replay from the start
  } else if (!playing) {
    // pick up where the visitor scrolled to
    var s = scrollers[current];
    var overflow = s.scrollHeight - s.clientHeight;
    if (overflow > 0 && s.scrollTop > 0) {
      elapsed = Math.max(elapsed, (0.2 + 0.65 * Math.min(1, s.scrollTop / overflow)) * duration);
      expectedTop = s.scrollTop;
    }
  }
  playing = !playing;
  paintPlay();
}

$('play').addEventListener('click', togglePlay);

// Rewind: restarts the page if you are a few seconds in, otherwise goes back one page
$('rewind').addEventListener('click', function () {
  if (elapsed > 3000 || current === 0) go(current);
  else go(current - 1);
});

$('next').addEventListener('click', function () { go(current + 1); });

// Any button with data-go="projects" jumps to that page
$$('[data-go]').forEach(function (el) {
  el.addEventListener('click', function () { goSlug(el.dataset.go); });
});

window.addEventListener('hashchange', function () {
  if (entered) goSlug(location.hash.slice(1), 'silent');
});

window.addEventListener('resize', function () { duration = pageDuration(current); });

document.addEventListener('keydown', function (e) {
  if (modalOpen()) return;
  if (!$('lightbox').hidden) {
    if (e.key === 'Escape') closeCert();
    if (e.key === 'ArrowRight') moveCert(1);
    if (e.key === 'ArrowLeft') moveCert(-1);
    return;
  }
  if (!entered) return;
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'ArrowRight') go(current + 1);
  if (e.key === 'ArrowLeft') go(current - 1);
  if (e.key === 'Home') go(0);
  if (e.key === 'End') go(pages.length - 1);
  if (e.key === ' ' && tag !== 'button' && tag !== 'a') { e.preventDefault(); togglePlay(); }
});

// Swipe left or right on a phone
var startX = null;
var startY = null;
sheets.addEventListener('touchstart', function (e) {
  if (e.target.closest('.curl')) { startX = null; return; }
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });
sheets.addEventListener('touchend', function (e) {
  if (startX === null) return;
  var dx = e.changedTouches[0].clientX - startX;
  var dy = e.changedTouches[0].clientY - startY;
  startX = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
}, { passive: true });


/* ==========================================================
   6. STAT COUNTERS (they count your content automatically)
   <b data-count=".cert"> counts every element with class "cert"
   ========================================================== */
function runCounters(scope) {
  $$('[data-count]', scope).forEach(function (el) {
    var total = document.querySelectorAll(el.dataset.count).length;
    var time = reduceMotion ? 0 : 900;
    var start = performance.now();
    (function step(now) {
      var t = time ? Math.min(1, (now - start) / time) : 1;
      el.textContent = Math.round(total * t);
      if (t < 1) requestAnimationFrame(step);
    })(start);
  });
}


/* ==========================================================
   7. CERTIFICATES: filters and the full-screen viewer
   ========================================================== */
var certs = $$('.cert');
var chips = $$('.chip[data-filter]');
var lightbox = $('lightbox');
var lbIndex = 0;
var lastFocus = null;

function visibleCerts() {
  return certs.filter(function (c) { return !c.hidden; });
}

function applyFilter(filter) {
  certs.forEach(function (c) {
    var cats = (c.dataset.cat || '').split(' ');
    c.hidden = !(filter === 'all' || cats.indexOf(filter) > -1);
  });
  chips.forEach(function (chip) {
    var on = chip.dataset.filter === filter;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', on);
  });
  $('cert-count').textContent = CERT_COUNT_TEXT
    .replace('{n}', visibleCerts().length)
    .replace('{total}', certs.length);
  duration = pageDuration(current);
}

chips.forEach(function (chip) {
  chip.addEventListener('click', function () { applyFilter(chip.dataset.filter); });
});
applyFilter('all');

function showCert() {
  var list = visibleCerts();
  var cert = list[lbIndex];
  var img = $('lb-img');
  var fallback = $('lb-fallback');
  var title = cert.querySelector('b').textContent;
  var caption = cert.dataset.caption || title;

  $('lb-cap').textContent = caption;
  fallback.textContent = title;
  fallback.hidden = false;
  img.hidden = true;

  if (cert.dataset.img) {
    img.onload = function () { img.hidden = false; fallback.hidden = true; };
    img.onerror = function () { img.hidden = true; fallback.hidden = false; };
    img.alt = caption;
    img.src = cert.dataset.img;
  }
  $('lb-prev').hidden = $('lb-next').hidden = list.length < 2;
}

function openCert(cert) {
  lastFocus = cert;
  lbIndex = visibleCerts().indexOf(cert);
  showCert();
  lightbox.hidden = false;
  $('lb-close').focus();
}

function closeCert() {
  lightbox.hidden = true;
  if (lastFocus) lastFocus.focus();
}

function moveCert(step) {
  var n = visibleCerts().length;
  lbIndex = (lbIndex + step + n) % n;
  showCert();
}

certs.forEach(function (cert) {
  cert.addEventListener('click', function () { openCert(cert); });
});
$('lb-close').addEventListener('click', closeCert);
$('lb-prev').addEventListener('click', function () { moveCert(-1); });
$('lb-next').addEventListener('click', function () { moveCert(1); });
lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeCert(); });

/* ==========================================================
   8. CONTACT: copy email and the message form
   ========================================================== */
var emailLink = $('email-link');

function emailAddress() {
  return emailLink.getAttribute('href').replace('mailto:', '');
}

$('copy-email').addEventListener('click', function () {
  var address = emailAddress();
  var done = function () { toast(COPIED_TEXT); burst($('copy-email'), 18); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(address).then(done, function () { toast(address); });
  } else {
    toast(address);
  }
});

// Opens the visitor's email app with the message already written
$('mailform').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('mf-name').value.trim();
  var message = $('mf-msg').value.trim();
  window.location.href = 'mailto:' + emailAddress() +
    '?subject=' + encodeURIComponent(MAIL_SUBJECT.replace('{name}', name)) +
    '&body=' + encodeURIComponent(message + '\n\n- ' + name);
});


/* ==========================================================
   9. LIGHT / DARK SWITCH
   ========================================================== */
var root = document.documentElement;
var themeBtn = $('theme-btn');

function isDark() {
  return root.dataset.theme
    ? root.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// shows a sun when it is dark (tap for day) and a moon when it is light
function paintThemeButton() { themeBtn.innerHTML = icon(isDark() ? 'sun' : 'moon'); }

try {
  var saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
} catch (e) {}
paintThemeButton();

themeBtn.addEventListener('click', function () {
  var next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  paintThemeButton();
});


/* ==========================================================
   10. INTRO: LOADING RING, THEN WELCOME, THEN OPEN THE FOLIO
   ========================================================== */
var intro = $('intro');
var meter = $('meter');
var RING = 327;   // length of the ring's outline

function showWelcome() {
  $('stage-loading').classList.remove('active');
  $('stage-welcome').classList.add('active');
  $('enter').focus({ preventScroll: true });
}

function enterSite() {
  if (entered) return;
  entered = true;
  haptic(14);
  burst($('enter'), 34);
  setTimeout(function () {
    intro.classList.add('done');
    intro.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('locked');
    $('bookwrap').classList.add('open');
    // if someone opened a link like yoursite.com/#projects, start on that page
    if (!goSlug(location.hash.slice(1), 'silent')) go(0, 'silent');
    lastTime = performance.now();
  }, reduceMotion ? 0 : 450);
  setTimeout(function () { intro.style.display = 'none'; }, 1700);
}

function loadStep(now) {
  var t = Math.min(1, (now - loadStart) / LOADING_MS);
  var eased = 1 - Math.pow(1 - t, 2);
  var percent = Math.round(eased * 100);
  var msg = LOADING_MESSAGES[Math.min(LOADING_MESSAGES.length - 1, Math.floor(eased * LOADING_MESSAGES.length))];
  meter.style.strokeDashoffset = RING * (1 - eased);
  $('pct').textContent = msg + ' ' + percent + '%';
  $('loadbox').setAttribute('aria-valuenow', percent);
  if (t < 1) {
    requestAnimationFrame(loadStep);
  } else {
    setTimeout(showWelcome, 300);
  }
}

paintPlay();
go(0, 'silent');
var loadStart = performance.now();
requestAnimationFrame(loadStep);
requestAnimationFrame(frame);
$('enter').addEventListener('click', enterSite);


/* ==========================================================
   11. ID CARD: drag it to swing like a real lanyard, tap or press Enter to flip it
   ========================================================== */
(function () {
  var hang = $('idhang'), card = $('idcard');
  if (!hang || !card) return;
  var holder = hang.parentNode;
  var a = 0, v = 0, dragging = false, moved = false, startPx = 0, prevA = 0, prevT = 0, last = performance.now(), t0 = last;

  function flip() {
    var on = card.classList.toggle('flipped');
    card.setAttribute('aria-pressed', on);
    burst(card, 14);
  }

  function pull(e) {
    var r = holder.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2), dy = Math.max(60, e.clientY - r.top);
    var next = Math.max(-40, Math.min(40, Math.atan(dx / dy) * 180 / Math.PI));
    var now = performance.now(), dt = Math.max(1, now - prevT) / 1000;
    v = Math.max(-400, Math.min(400, (next - prevA) / dt));
    a = prevA = next;
    prevT = now;
  }

  card.addEventListener('pointerdown', function (e) {
    dragging = true; moved = false; startPx = e.clientX; prevA = a; prevT = performance.now();
    card.setPointerCapture(e.pointerId);
  });

  card.addEventListener('pointermove', function (e) {
    var r = card.getBoundingClientRect();
    card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
    card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
    if (!dragging) return;
    if (Math.abs(e.clientX - startPx) > 6) moved = true;
    if (moved) pull(e);
  });

  card.addEventListener('pointerup', function () {
    if (!dragging) return;
    dragging = false;
    if (!moved) flip();
  });
  card.addEventListener('pointercancel', function () { dragging = false; });

  card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); flip(); }
  });

  // keep a sideways drag on the card from also flipping the page
  card.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  card.addEventListener('touchend', function (e) { e.stopPropagation(); }, { passive: true });

  (function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      var rest = reduceMotion ? 0 : Math.sin((now - t0) / 1100) * 2.2;   // a gentle idle sway
      v += (-26 * (a - rest) - 2.6 * v) * dt;
      a += v * dt;
    }
    hang.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
    requestAnimationFrame(tick);
  })(last);
})();