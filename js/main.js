// Durden Roof Care - simple interactions
document.addEventListener('DOMContentLoaded', function(){
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  var nav = document.querySelector('.main-nav');
  var navWrap = document.querySelector('.nav');
  if (nav && navWrap && !document.querySelector('.nav-toggle')) {
    var toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.setAttribute('aria-controls', 'main-navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    nav.id = nav.id || 'main-navigation';
    navWrap.insertBefore(toggle, nav);

    toggle.addEventListener('click', function(){
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    nav.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      });
    });

    document.addEventListener('click', function(e){
      if (!navWrap.contains(e.target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      }
    });
  }

  var reviews = document.querySelector('[class*="elfsight-app-"]');
  if (reviews && !document.querySelector('script[src*="static.elfsight.com/platform/platform.js"]')) {
    var loadElfsight = function(){
      if (document.querySelector('script[src*="static.elfsight.com/platform/platform.js"]')) return;
      var script = document.createElement('script');
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.async = true;
      document.body.appendChild(script);
    };

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries){
        if (entries.some(function(entry){ return entry.isIntersecting; })) {
          loadElfsight();
          observer.disconnect();
        }
      }, {rootMargin:'250px 0px'});
      observer.observe(reviews);
    } else {
      window.setTimeout(loadElfsight, 1200);
    }
  }

  // Smooth scroll for in-page links
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if (id.length > 1) {
        var target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({behavior:'smooth', block:'start'});
        }
      }
    });
  });
});

// Quote form handler (placeholder until backend is wired up)
function handleQuote(e){
  e.preventDefault();
  var f = e.target;
  var data = new FormData(f);
  var first = data.get('first') || '';
  var email = data.get('email') || '';
  // For now, open an email to durdenroofcare@gmail.com with the details.
  var body = '';
  data.forEach(function(v,k){ body += k + ': ' + v + '\n'; });
  var subject = encodeURIComponent('Free Quote Request - ' + first);
  window.location.href = 'mailto:durdenroofcare@gmail.com?subject=' + subject + '&body=' + encodeURIComponent(body);
  return false;
}
