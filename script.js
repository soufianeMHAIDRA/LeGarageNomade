(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  var form = document.getElementById('notify-form');
  var input = document.getElementById('email');
  var status = document.getElementById('form-status');
  var button = form.querySelector('button');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function show(msg, ok) {
    status.textContent = msg;
    status.className = 'status ' + (ok ? 'ok' : 'err');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();

    if (!emailRe.test(email)) {
      show('Veuillez saisir une adresse e-mail valide.', false);
      input.focus();
      return;
    }

    button.disabled = true;
    // Same endpoint Brevo's own embed script uses; it replies with JSON and allows cross-origin requests.
    fetch(form.action + '?isAjax=1', {
      method: 'POST',
      body: new FormData(form)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          show('Merci ! Vous serez prévenu dès notre lancement.', true);
          form.reset();
        } else if (data.errors && data.errors.EMAIL) {
          show('Veuillez saisir une adresse e-mail valide.', false);
        } else {
          show('Une erreur est survenue. Veuillez réessayer plus tard.', false);
        }
      })
      .catch(function () {
        show('Une erreur est survenue. Veuillez réessayer plus tard.', false);
      })
      .finally(function () { button.disabled = false; });
  });

  /* ---------- contact pop-up (Web3Forms) ---------- */
  var modal = document.getElementById('contact-modal');
  var openBtn = document.getElementById('contact-open');
  if (!modal || typeof modal.showModal !== 'function') return;

  var cForm = document.getElementById('contact-form');
  var cStatus = document.getElementById('contact-status');
  var cSubmit = cForm.querySelector('button[type="submit"]');
  var closeTimer;

  function cShow(msg, ok) {
    cStatus.textContent = msg;
    cStatus.className = msg ? 'status ' + (ok ? 'ok' : 'err') : 'status';
  }

  openBtn.hidden = false;
  openBtn.addEventListener('click', function () {
    clearTimeout(closeTimer);
    cShow('', true);
    modal.showModal();
    document.getElementById('contact-name').focus();
  });
  document.getElementById('contact-close').addEventListener('click', function () { modal.close(); });
  // Close when clicking the dimmed backdrop
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  // Native dialogs close on Escape, but some embedded browsers don't, so handle it explicitly.
  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); modal.close(); }
  });
  modal.addEventListener('close', function () { openBtn.focus(); });

  cForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = cForm.elements.name.value.trim();
    var email = cForm.elements.email.value.trim();
    var message = cForm.elements.message.value.trim();

    if (!name) { cShow('Veuillez indiquer votre nom.', false); cForm.elements.name.focus(); return; }
    if (!emailRe.test(email)) { cShow('Veuillez saisir une adresse e-mail valide.', false); cForm.elements.email.focus(); return; }
    if (message.length < 10) { cShow('Votre message est un peu court (10 caractères minimum).', false); cForm.elements.message.focus(); return; }

    var data = {};
    new FormData(cForm).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });

    cSubmit.disabled = true;
    cShow('Envoi en cours…', true);
    fetch(cForm.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (json.success) {
          cShow('Merci ! Votre message a bien été envoyé, nous vous répondrons rapidement.', true);
          cForm.reset();
          closeTimer = setTimeout(function () { modal.close(); }, 3500);
        } else {
          cShow('L\'envoi a échoué. Veuillez réessayer plus tard.', false);
        }
      })
      .catch(function () {
        cShow('L\'envoi a échoué. Vérifiez votre connexion et réessayez.', false);
      })
      .finally(function () { cSubmit.disabled = false; });
  });
})();
