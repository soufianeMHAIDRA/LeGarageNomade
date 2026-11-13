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
})();
