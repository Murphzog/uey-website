(function () {
  // Aperture module: circle opens to full width (only on pages that have it)
  var ap = document.getElementById('ap'), b = document.getElementById('apBtn');
  if (ap && b) {
    b.addEventListener('click', function () {
      var open = ap.classList.toggle('open');
      b.setAttribute('aria-expanded', open);
      b.textContent = open ? 'Close the map' : 'Open the map';
    });
  }

  // Forms → Supabase Edge Function "submit-form" (see SETUP.md)
  var cfg = window.UEY_CONFIG || {};
  var endpoint = cfg.SUPABASE_URL ? cfg.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/submit-form' : '';
  var CONTACT = 'urbansystemsorganization@gmail.com';

  var MESSAGES = {
    volunteer: 'Thanks. We got it and will follow up before the next briefing.',
    visit: "Thanks. We got your request and will be in touch to find a time.",
    newsletter: "Thanks. You're on the list."
  };

  Array.prototype.forEach.call(document.querySelectorAll('form[data-form]'), function (f) {
    var type = f.getAttribute('data-form');
    var status = f.querySelector('.status');
    var btn = f.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : '';

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

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok) throw new Error(body.error || 'Request failed');
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
          if (btn) { btn.disabled = false; btn.textContent = label; }
        });
    });
  });
})();
