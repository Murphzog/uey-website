(function () {
  // Scroll reveal: .rv elements blur-fade in once, the first time they come within 10% of the viewport bottom.
  // Runs first, in its own function, so its early returns never skip the rest of this file.
  (function () {
    var root = document.documentElement;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

    var watch = function (el) {
      if (el.classList.contains('rv-in') || el.classList.contains('rv-on')) return;
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('rv-on'); // already on screen: show as is
      else io.observe(el);
    };
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), watch);
    root.classList.add('rv-io'); // only now can .rv content be hidden

    // Content added later also reveals
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof Element)) return;
          if (n.classList.contains('rv')) watch(n);
          Array.prototype.forEach.call(n.querySelectorAll('.rv'), watch);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  })();

  // Aperture module: circle opens to full width (only on pages that have it)
  var ap = document.getElementById('ap'), b = document.getElementById('apBtn');
  if (ap && b) {
    b.addEventListener('click', function () {
      var open = ap.classList.toggle('open');
      b.setAttribute('aria-expanded', open);
      b.textContent = open ? 'Close the map' : 'Open the map';
    });
  }

  // Arrow drawing helpers for the flow maps (Schools, Volunteer)
  var NS = 'http://www.w3.org/2000/svg';
  var GAP = 12.3, BEND = 12, HEAD = 8; // GAP: space between the text and an arrow's start or tip

  // The tight bounds of the text inside an element (line boxes, not the element's full width)
  var textBox = function (el) {
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var range = document.createRange(), b = null, node;
    while ((node = walk.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      range.selectNodeContents(node);
      var r = range.getBoundingClientRect();
      b = b ? { left: Math.min(b.left, r.left), right: Math.max(b.right, r.right), top: Math.min(b.top, r.top), bottom: Math.max(b.bottom, r.bottom) }
            : { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }
    b = b || el.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, mid: (b.top + b.bottom) / 2 };
  };

  // A path through points p with rounded elbows
  var roundedPath = function (p) {
    var d = 'M' + p[0].x + ' ' + p[0].y;
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], c = p[i], n = p[i + 1];
      var l1 = Math.hypot(c.x - a.x, c.y - a.y), l2 = Math.hypot(n.x - c.x, n.y - c.y);
      var r = Math.min(BEND, l1 / 2, l2 / 2);
      d += 'L' + (c.x - (c.x - a.x) / l1 * r) + ' ' + (c.y - (c.y - a.y) / l1 * r) +
           'Q' + c.x + ' ' + c.y + ' ' + (c.x + (n.x - c.x) / l2 * r) + ' ' + (c.y + (n.y - c.y) / l2 * r);
    }
    var e = p[p.length - 1];
    return d + 'L' + e.x + ' ' + e.y;
  };

  // Draw one elbow arrow (line plus arrowhead at the last point) into an svg
  var drawArrow = function (svg, p) {
    var add = function (cls, d) {
      var el = document.createElementNS(NS, 'path');
      el.setAttribute('class', cls);
      el.setAttribute('d', d);
      svg.appendChild(el);
    };
    add('flow-link', roundedPath(p));
    var e = p[p.length - 1], f = p[p.length - 2], len = Math.hypot(e.x - f.x, e.y - f.y);
    var ux = (e.x - f.x) / len, uy = (e.y - f.y) / len;
    add('flow-arrow', 'M' + (e.x - HEAD * ux - HEAD * .75 * uy) + ' ' + (e.y - HEAD * uy + HEAD * .75 * ux) +
                      'L' + e.x + ' ' + e.y +
                      'L' + (e.x - HEAD * ux + HEAD * .75 * uy) + ' ' + (e.y - HEAD * uy - HEAD * .75 * ux));
  };

  // Redraw on resize and once web fonts arrive (they change line wrapping)
  var keepDrawn = function (el, draw) {
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(el);
    else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  };

  // Flow map: elbow arrows between the text of numbered steps. Each leaves the middle of a step's right
  // edge, runs across, then turns into the middle of the next step's top (if lower) or bottom (if higher).
  // Elbows are rounded. Phones stack the steps and hide the arrows (css/site.css).
  Array.prototype.forEach.call(document.querySelectorAll('.flow'), function (flow) {
    var svg = flow.querySelector('.flow-line');
    var list = flow.querySelector('.flow-steps');
    if (!svg || !list) return;
    var steps = list.querySelectorAll('.flow-step');
    var CLEAR = 32;
    var row = flow.classList.contains('flow--row'), ROW_CLEAR = 32; // ROW_CLEAR: how far a row map's arrows run outside the text

    // A step's text box: its heading and paragraph, not the dot
    var text = function (s) { return textBox(s.querySelector('.flow-body')); };

    var draw = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      Array.prototype.forEach.call(steps, function (s) { s.style.marginTop = ''; });
      if (getComputedStyle(svg).display === 'none') return;

      var margin = function (s, add) { s.style.marginTop = (parseFloat(getComputedStyle(s).marginTop) || 0) + add + 'px'; };

      // Space the steps so each arrow's across run clears the next step's text.
      // A step lower than the last must start below the last one's middle; a higher one must end above it.
      // Row maps keep every step on one line, so they skip this.
      for (var pass = 0; pass < (row ? 0 : 3); pass++) {
        for (var j = 1; j < steps.length; j++) {
          var prev = steps[j - 1], cur = steps[j], ta = text(prev), tb = text(cur);
          var down = parseFloat(getComputedStyle(cur).getPropertyValue('--y')) > parseFloat(getComputedStyle(prev).getPropertyValue('--y'));
          var short = down ? ta.mid + CLEAR - tb.top : tb.bottom + CLEAR - ta.mid;
          if (short > 0) margin(down ? cur : prev, short);
        }
      }

      var box = flow.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      var pts = Array.prototype.map.call(steps, function (s) {
        var t = text(s);
        // capTop: where the heading's capital letters start (the text box top includes empty space above them)
        var fs = parseFloat(getComputedStyle(s.querySelector('.flow-body h3') || s).fontSize);
        return { left: t.left - box.left, right: t.right - box.left, top: t.top - box.top, bottom: t.bottom - box.top,
                 capTop: t.top - box.top + fs * 0.24, cx: (t.left + t.right) / 2 - box.left, mid: t.mid - box.top };
      });

      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if (row) {
          // Row map: arrows alternate over the top (1 to 2) and under the bottom (2 to 3), each leaving the middle
          // of one step's text and landing on the middle of the next. The run clears both steps' text and dots.
          if (i % 2 === 0) {
            var over = Math.min(a.top, b.top) - ROW_CLEAR;
            drawArrow(svg, [{ x: a.cx, y: a.capTop - GAP }, { x: a.cx, y: over }, { x: b.cx, y: over }, { x: b.cx, y: b.capTop - GAP }]);
          } else {
            var under = Math.max(a.bottom, b.bottom) + ROW_CLEAR;
            drawArrow(svg, [{ x: a.cx, y: a.bottom + GAP }, { x: a.cx, y: under }, { x: b.cx, y: under }, { x: b.cx, y: b.bottom + GAP }]);
          }
          continue;
        }
        // Out of the middle of this step's right edge, across, then into the middle of the next step's top or bottom
        var into = b.top > a.mid ? b.capTop - GAP : b.bottom + GAP;
        drawArrow(svg, [{ x: a.right + GAP, y: a.mid }, { x: b.cx, y: a.mid }, { x: b.cx, y: into }]);
      }
    };

    keepDrawn(flow, draw);
  });

  // "Why it exists" boxes (About): they start centered and slide out together to their left or right spots
  // as the group scrolls up the screen, and slide back to center together when scrolled back down. Tied to
  // scroll position, so it reverses naturally. Off for reduced motion.
  (function () {
    var lists = document.querySelectorAll('.globs');
    if (!lists.length) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var START = 0.25; // stay centered until the top of the group is 25% of the way up from the screen bottom
    var END = 0.45;   // fully out once the middle of the group reaches 45% of the way down the screen
    var queued = false;

    var update = function () {
      queued = false;
      var vh = window.innerHeight;
      Array.prototype.forEach.call(lists, function (list) {
        // One progress value for the whole group, so every box moves at the same time
        var lr = list.getBoundingClientRect();
        var startTop = vh * (1 - START);
        var p = (startTop - lr.top) / (startTop - vh * END + lr.height / 2); // 0 at START, 1 at END
        p = Math.max(0, Math.min(1, p));
        var e = p * p * (3 - 2 * p);                              // ease in and out
        Array.prototype.forEach.call(list.querySelectorAll('.glob--left, .glob--right'), function (g) {
          var r = g.getBoundingClientRect();
          var naturalLeft = r.left - (g._tx || 0);
          var shift = lr.left + (lr.width - r.width) / 2 - naturalLeft; // distance from its spot to center
          g._tx = shift * (1 - e);
          g.style.translate = g._tx.toFixed(1) + 'px 0';
        });
      });
    };
    var queue = function () { if (!queued) { queued = true; requestAnimationFrame(update); } };

    update();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  })();

  // Placeholder links (href="#") do nothing until they get a real page
  Array.prototype.forEach.call(document.querySelectorAll('a[href="#"]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // Forms → Google Apps Script web app that saves to a Google Sheet (see SETUP.md)
  var cfg = window.UEY_CONFIG || {};
  var endpoint = cfg.FORMS_URL || '';
  var CONTACT = 'uey@urban-systems.org';

  var MESSAGES = {
    volunteer: 'Thanks. We got it and will follow up before the next briefing.',
    visit: "Thanks. We got your request and will be in touch to find a time.",
    newsletter: "Thanks. You're on the list.",
    contact: "Thanks. Your message reached the UEY team, and we'll reply by email."
  };

  Array.prototype.forEach.call(document.querySelectorAll('form[data-form]'), function (f) {
    var type = f.getAttribute('data-form');
    var status = f.querySelector('.status');
    var btn = f.querySelector('button[type="submit"]');
    var label = btn ? btn.innerHTML : '';

    function say(msg) { if (status) status.textContent = msg; }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }

      if (!endpoint) {
        say('Thanks. This preview form is not connected yet, so nothing was sent.');
        return;
      }

      var data = { form: type };
      new FormData(f).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });

      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      say('');

      // Sent as plain text with no custom headers: Google's script endpoint can't answer the browser's
      // pre-check for JSON requests. Google always replies 200, so success is read from the reply itself.
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok || !body.ok) throw new Error(body.error || 'Request failed');
            return body;
          });
        })
        .then(function () {
          f.reset();
          say(MESSAGES[type] || 'Thanks. We got it.');
        })
        .catch(function (err) {
          var specific = err && err.message && /^Please /.test(err.message);
          say(specific ? err.message : "That didn't go through. Try again, or email " + CONTACT + '.');
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = label; }
        });
    });
  });
})();
