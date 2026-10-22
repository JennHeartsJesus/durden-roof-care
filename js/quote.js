(function () {
  'use strict';
  var form = document.getElementById('quote-form');
  var status = document.getElementById('form-status');
  if (!form || !status) return;
  var button = form.querySelector('button[type="submit"]');
  var pending = false;
  var contactLinks = 'Please call <a href="tel:+12282294704">(228) 229-4704</a> or email <a href="mailto:durdenroofcare@gmail.com">durdenroofcare@gmail.com</a>';

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.dataset.state = 'sending';
    status.textContent = 'Sending your request. Please keep this page open.';
    status.style.color = '#334155';
    var controller = new AbortController();
    var slowTimer = setTimeout(function () {
      status.dataset.state = 'waiting';
      status.textContent = 'Thank you for your patience. We are still waiting for confirmation. Please keep this page open and avoid submitting again.';
    }, 15000);
    // A slow reply is not proof that the email failed. Allow extra time for
    // the provider to acknowledge receipt, without retrying the submission.
    var timer = setTimeout(function () { controller.abort(); }, 120000);
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
      if (response.ok && result && (result.success === false || result.success === 'false')) {
        var rejection = new Error('Request not accepted');
        rejection.name = 'SubmissionRejected';
        throw rejection;
      }
      if (!response.ok || !result || (result.success !== true && result.success !== 'true')) {
        throw new Error('Receipt could not be confirmed');
      }
      status.dataset.state = 'success';
      status.textContent = 'Thank you! Your quote request was submitted successfully. We will reach out shortly.';
      status.style.color = '#166534';
      form.reset();
    } catch (error) {
      if (error.name === 'SubmissionRejected') {
        status.dataset.state = 'error';
        status.innerHTML = 'The submission service did not accept your request. Your information is still here. ' + contactLinks + ' so we can help.';
        status.style.color = '#991b1b';
      } else {
        status.dataset.state = 'unconfirmed';
        status.innerHTML = 'Your request may already have reached our team, but the confirmation did not come through. Your information is still here. ' + contactLinks + ' to confirm receipt before submitting again.';
        status.style.color = '#334155';
      }
    } finally {
      clearTimeout(timer);
      clearTimeout(slowTimer);
      pending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
