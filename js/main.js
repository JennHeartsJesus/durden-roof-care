// Durden Roof Care - simple interactions
document.addEventListener('DOMContentLoaded', function(){
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

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
