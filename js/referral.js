document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('referral-form');
  if (!form) return;
  var status = document.getElementById('referral-status');
  var button = form.querySelector('button[type="submit"]');
  var sending = false;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    if (form.elements._honey.value) return;
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending...';
    status.dataset.state = 'pending';
    status.textContent = 'Sending your referral...';
    var payload = Object.fromEntries(new FormData(form).entries());
    payload._subject = 'New Referral - DurdenRoofCare.com';
    payload._template = 'table';
    payload._captcha = 'false';
    payload._replyto = payload.referrer_email;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch('https://formsubmit.co/ajax/durdenroofcare@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || (result.success !== true && result.success !== 'true')) throw new Error('Referral not accepted');
      status.dataset.state = 'success';
      status.textContent = 'Thank you! Your referral has been submitted to Durden Roof Care.';
      form.reset();
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = 'We could not confirm your submission. Your information is still here. Please try again, or call (228) 229-4704 before resubmitting if you are unsure whether it went through.';
    } finally {
      clearTimeout(timer);
      sending = false;
      button.disabled = false;
      button.textContent = 'Submit Referral';
      status.focus();
    }
  });
});
