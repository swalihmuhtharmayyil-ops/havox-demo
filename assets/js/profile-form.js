(function () {
  var form = document.getElementById('email-form');
  if (!form) return;
  var wrap = form.closest('.w-form');
  var done = wrap.querySelector('.w-form-done');
  var fail = wrap.querySelector('.w-form-fail');
  var errText = document.getElementById('form-error-text');
  var story = document.getElementById('story');
  var counter = document.getElementById('story-count');
  var btn = form.querySelector('input[type=submit]');
  var MAX = 200;

  function words(t) { t = t.trim(); return t ? t.split(/\s+/).length : 0; }
  function updateCount() {
    var n = words(story.value);
    counter.textContent = n + ' / ' + MAX + ' words';
    counter.style.color = n > MAX ? '#ff8a8a' : '';
  }
  story.addEventListener('input', updateCount);
  updateCount();

  function showError(msg) {
    errText.textContent = msg;
    fail.style.display = 'block';
    done.style.display = 'none';
  }

  // capture phase so Webflow's own form handler never runs
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    fail.style.display = 'none';

    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (words(story.value) > MAX) { showError('Please keep your story within ' + MAX + ' words.'); return; }

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    var original = btn.value;
    btn.value = btn.getAttribute('data-wait') || 'Please wait...';
    btn.disabled = true;

    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error || 'failed');
        form.style.display = 'none';
        done.style.display = 'block';
      })
      .catch(function (err) {
        showError(err.message && err.message !== 'failed' ? err.message : 'Oops! Something went wrong while submitting the form.');
      })
      .finally(function () { btn.value = original; btn.disabled = false; });
  }, true);
})();
