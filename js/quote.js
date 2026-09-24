(function () {
  'use strict';
  var form = document.getElementById('quote-form');
  var status = document.getElementById('form-status');
  if (!form || !status) return;
  var button = form.querySelector('button[type="submit"]');
  var pending = false;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.dataset.state = 'sending';
    status.textContent = 'Sending your request…';
    status.style.color = '#334155';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 30000);
    try {
      var body = {};
      new FormData(form).forEach(function (value, key) { body[key] = value; });
      body._subject = 'New Quote Request - DurdenRoofCare.com';
      body._template = 'table';
      body._captcha = 'false';
      var response = await fetch('https://formsubmit.co/ajax/durdenroofcare@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || (result.success !== true && result.success !== 'true')) {
        throw new Error('Request not accepted');
      }
      status.dataset.state = 'success';
      status.textContent = 'Thank you! Your quote request was submitted successfully. We will reach out shortly.';
      status.style.color = '#166534';
      form.reset();
    } catch (error) {
      status.dataset.state = 'error';
      status.innerHTML = 'We could not confirm your request was sent. Your information is still here. Please call <a href="tel:+12282294704">(228) 229-4704</a> or email <a href="mailto:durdenroofcare@gmail.com">durdenroofcare@gmail.com</a> for help.';
      status.style.color = '#991b1b';
    } finally {
      clearTimeout(timer);
      pending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
