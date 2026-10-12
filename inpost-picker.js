// Oficjalny selektor punktów InPost. Publiczny klucz Geowidget jest pobierany
// ze zmiennej INPOST_GEOWIDGET_TOKEN na serwerze (nie jest to klucz ShipX).
(function () {
  const widgetUrl = 'https://geowidget.inpost.pl/inpost-geowidget.js';
  const cssUrl = 'https://geowidget.inpost.pl/inpost-geowidget.css';
  let scriptPromise;

  function loadScript() {
    if (customElements.get('inpost-geowidget')) return Promise.resolve();
    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-bd-inpost]')) {
          const css = document.createElement('link');
          css.rel = 'stylesheet'; css.href = cssUrl;
          css.dataset.bdInpost = '1'; document.head.appendChild(css);
        }
        const script = document.createElement('script');
        script.src = widgetUrl;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Nie udało się załadować mapy InPost.'));
        document.head.appendChild(script);
      }).catch(err => { scriptPromise = null; throw err; });
    }
    return scriptPromise;
  }

  window.setupInpostPicker = async function setupInpostPicker(root) {
    const locker = root.querySelector('[name="lockerCode"]');
    const button = root.querySelector('[data-inpost-open]');
    const map = root.querySelector('[data-inpost-map]');
    const info = root.querySelector('[data-inpost-info]');
    if (!locker || !button || !map || !info) return;

    locker.placeholder = 'Wybierz punkt InPost';
    locker.autocomplete = 'off';
    let token = '';
    try {
      const response = await fetch('/api/inpost-widget-config', {cache:'no-store'});
      if (response.ok) {
        const data = await response.json();
        token = typeof data.token === 'string' ? data.token.trim() : '';
      }
    } catch (error) { console.warn('Konfiguracja mapy InPost:',error); }

    if (!locker.isConnected) return;
    if (!token) {
      locker.readOnly = false;
      button.textContent = '📍 Znajdź punkt na mapie InPost ↗';
      info.textContent = 'Otwórz mapę InPost, znajdź punkt po ulicy lub na mapie i przepisz jego kod powyżej.';
      button.addEventListener('click', () => {
        window.open('https://inpost.pl/znajdz-paczkomat','_blank','noopener,noreferrer');
      });
      return;
    }

    locker.readOnly = true;
    locker.placeholder = 'Kliknij „Wybierz na mapie”';
    button.textContent = '📍 Wybierz paczkomat na mapie';
    info.textContent = 'Wyszukaj ulicę lub zaznacz punkt na mapie — kod wypełni się automatycznie.';

    if (window.__bdInpostPointListener) {
      document.removeEventListener('onpointselect',window.__bdInpostPointListener);
    }
    window.__bdInpostPointListener = (event) => {
      const point = event.detail || event.details || {};
      const code = String(point.name || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{3,30}$/.test(code)) return;
      locker.value = code;
      locker.dispatchEvent(new Event('input',{bubbles:true}));
      const address = point.address || {};
      const line = address.line1 || [address.street,address.building_number].filter(Boolean).join(' ');
      info.textContent = '✓ Wybrany punkt: ' + code + (line ? ' — ' + line : '');
      map.hidden = true;
      button.textContent = '📍 Zmień paczkomat';
    };
    document.addEventListener('onpointselect',window.__bdInpostPointListener);

    button.addEventListener('click', async () => {
      if (!locker.readOnly) {
        window.open('https://inpost.pl/znajdz-paczkomat','_blank','noopener,noreferrer');
        return;
      }
      if (!map.hidden) {
        map.hidden = true;
        button.textContent = locker.value ? '📍 Zmień paczkomat' : '📍 Wybierz paczkomat na mapie';
        return;
      }
      map.hidden = false;
      button.disabled = true;
      button.textContent = 'Otwieranie mapy…';
      try {
        await loadScript();
        if (!locker.isConnected) return;
        if (!map.querySelector('inpost-geowidget')) {
          const widget = document.createElement('inpost-geowidget');
          widget.setAttribute('token', token);
          widget.setAttribute('language', 'pl');
          widget.setAttribute('config', 'parcelCollect');
          widget.setAttribute('onpoint', 'onpointselect');
          map.appendChild(widget);
        }
        button.textContent = 'Zamknij mapę';
      } catch (error) {
        map.hidden = true;
        locker.readOnly = false;
        info.textContent = 'Mapa jest chwilowo niedostępna. Możesz wpisać kod punktu ręcznie.';
        button.textContent = '📍 Otwórz mapę InPost ↗';
        button.onclick = () => window.open('https://inpost.pl/znajdz-paczkomat','_blank','noopener,noreferrer');
      } finally {
        button.disabled = false;
      }
    });
  };
})();
