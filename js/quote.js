(function () {
  'use strict';
  var form = document.getElementById('quote-form');
  var status = document.getElementById('form-status');
  if (!form || !status) return;
  var button = form.querySelector('button[type="submit"]');
  var pending = false;
  var received = false;
  var savedAttempt = null;
  var endpoint = 'https://yufkrzymwzhpkgbbvqbs.supabase.co/functions/v1/website-quote';
  // Public gateway key only. Database access remains denied by RLS.
  var publicKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1Zmtyenltd3pocGtnYmJ2cWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5OTE5MDksImV4cCI6MjEwNTU2NzkwOX0.euOTZ2dQhCN_HNuUOprV3RrHWX68udzGqzsgG-x3Ni0';
  var contactLinks = 'Please call <a href="tel:+12282294704">(228) 229-4704</a> or <a href="mailto:durdenroofcare@gmail.com">email our team</a>';
  function show(state, text, color, links) {
    status.dataset.state = state;
    status.style.color = color;
    status.textContent = text;
    if (links) {
      var span = document.createElement('span');
      span.innerHTML = ' ' + contactLinks + links;
      status.appendChild(span);
    }
    status.focus({preventScroll: true});
    status.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function requestId(payload) {
    var bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    var signature = Array.from(new Uint8Array(bytes)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');
    try { savedAttempt = JSON.parse(sessionStorage.getItem('drc-quote-attempt')) || savedAttempt; } catch (_) {}
    if (!savedAttempt || savedAttempt.signature !== signature || Date.now() - savedAttempt.time > 86400000) {
      savedAttempt = {id:crypto.randomUUID(),signature:signature,time:Date.now()};
      try { sessionStorage.setItem('drc-quote-attempt', JSON.stringify(savedAttempt)); } catch (_) {}
    }
    return savedAttempt.id;
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || received || !form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending your request…';
    form.setAttribute('aria-busy', 'true');
    show('sending','Sending your request. Please keep this page open.','#334155');
    var controller = new AbortController();
    var timer = setTimeout(function(){controller.abort();},30000);
    try {
      var body = Object.fromEntries(new FormData(form).entries());
      body.id = await requestId(body);
      var response = await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+publicKey,'apikey':publicKey},
        body:JSON.stringify(body),
        signal:controller.signal
      });
      var result = await response.json();
      if (!response.ok) {
        if (response.status === 429) {
          show('error','We could not accept another request right now. Your information is still here.','#991b1b',' for assistance.');
        } else if (response.status === 400) {
          show('error','Please check your name, phone number, email and message, then try again. Your information is still here.','#991b1b');
        } else {
          show('unconfirmed','We could not confirm receipt. Your information is still here.','#334155',' before submitting again.');
        }
        return;
      }
      if (result.ok !== true || !/^DRC-[0-9A-F]{8}$/.test(result.reference || '')) throw new Error('Unconfirmed receipt');
      received = true;
      if (result.notification === 'accepted') {
        show('success','Thank you! Your quote request has been received. Our team will reach out shortly. Reference: '+result.reference+'.','#166534');
        form.reset();
      } else {
        show('saved','Your request has been saved, but we could not confirm the email notification to our team. Reference: '+result.reference+'. Please do not submit it again.','#334155',' and mention this reference so we can help promptly.');
      }
    } catch (_) {
      show('unconfirmed','We could not confirm receipt. Your information is still here.','#334155',' to check before trying again.');
    } finally {
      clearTimeout(timer);
      pending = false;
      button.disabled = received;
      button.textContent = received ? 'Request received' : 'Request Complimentary Quote';
      form.removeAttribute('aria-busy');
    }
  });
})();
