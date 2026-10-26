// Muestra el aviso "debe ejecutarse en Electron" si la página se abre en un navegador.
(function () {
  if (!window.electronAPI) {
    const el = document.getElementById('electron-not-found')
    if (el) {
      el.classList.add('visible')
      const rootEl = document.getElementById('root')
      if (rootEl) {
        rootEl.style.display = 'none'
      }
    }
  }
})()
