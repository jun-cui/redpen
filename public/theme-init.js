// Applies a saved light/dark choice before first paint, so the page never flashes the wrong
// theme. Loaded as a classic blocking script from <head> (the CSP forbids inline scripts),
// after the theme-color metas it updates. With no saved choice, or 'system', the CSS and the
// metas' media queries already follow the system setting. Mirrors src/lib/theme.ts.
;(function () {
  var COLOURS = { light: '#f6f3ee', dark: '#1a1816' }
  var preference = null
  try {
    preference = window.localStorage.getItem('redpen.theme')
  } catch (error) {
    // Storage is unavailable (for example, blocked by the browser): follow the system.
  }
  if (preference !== 'light' && preference !== 'dark') return

  document.documentElement.dataset.theme = preference
  var metas = document.querySelectorAll('meta[name="theme-color"]')
  for (var i = 0; i < metas.length; i++) {
    metas[i].setAttribute('content', COLOURS[preference])
  }
})()
