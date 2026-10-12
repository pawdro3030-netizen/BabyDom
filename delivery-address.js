// Wybór paczkomatu nie wymaga wpisywania domowego adresu, jeśli InPost
// przekazał kompletny adres wybranego punktu. Dane adresowe w wysyłanym
// zamówieniu zachowują dotychczasowy format (street, postalCode, city).
(function () {
  function normalizePostcode(value) {
    const v = String(value || '').trim();
    return /^\d{5}$/.test(v) ? v.slice(0,2) + '-' + v.slice(2) : v;
  }

  window.setupBabyDomDeliveryAddress = function (form) {
    const box = form.querySelector('[data-delivery-address]');
    const locker = form.querySelector('[name="lockerCode"]');
    const street = form.querySelector('[name="street"]');
    const postcode = form.querySelector('[name="postalCode"],[name="postcode"]');
    const city = form.querySelector('[name="city"]');
    if (!box || !locker || !street || !postcode || !city) return null;

    const note = box.querySelector('[data-address-note]');
    const fields = [street,postcode,city];
    let activeMethod = null;
    let courierAddress = {street:'',postalCode:'',city:''};
    let pointAddress = {street:'',postalCode:'',city:''};
    const read = () => ({
      street:street.value.trim(),
      postalCode:normalizePostcode(postcode.value),
      city:city.value.trim()
    });
    const apply = address => {
      street.value = address.street || '';
      postcode.value = address.postalCode || '';
      city.value = address.city || '';
    };
    const complete = address => Boolean(
      address.street && /^\d{2}-\d{3}$/.test(normalizePostcode(address.postalCode)) && address.city
    );

    function refresh() {
      const parcel = activeMethod === 'paczkomat';
      const hasCode = /^[A-Z0-9]{3,30}$/.test(locker.value.trim().toUpperCase());
      const needsAddress = !parcel || (hasCode && !complete(read()));
      box.hidden = !needsAddress;
      fields.forEach(field => { field.required = needsAddress; });
      if (note) {
        note.textContent = parcel
          ? 'Nie udało się pobrać pełnego adresu punktu z mapy. Uzupełnij brakujące dane adresowe.'
          : 'Adres dostawy dla kuriera.';
      }
    }

    function setDelivery(method) {
      const next = method === 'kurier' ? 'kurier' : 'paczkomat';
      if (activeMethod !== next) {
        if (activeMethod === 'kurier') courierAddress = read();
        if (activeMethod === 'paczkomat') pointAddress = read();
        activeMethod = next;
        apply(next === 'kurier' ? courierAddress : pointAddress);
      }
      refresh();
    }

    locker.addEventListener('input', () => {
      if (activeMethod !== 'paczkomat') return;
      // Ręczny kod nie poświadcza adresu. Event wyboru na mapie poda adres osobno.
      pointAddress = {street:'',postalCode:'',city:''};
      apply(pointAddress);
      refresh();
    });
    locker.addEventListener('inpost-point-selected', (event) => {
      const address = event.detail?.address || {};
      pointAddress = {
        street:String(address.street || '').trim(),
        postalCode:normalizePostcode(address.postalCode),
        city:String(address.city || '').trim()
      };
      if (activeMethod === 'paczkomat') apply(pointAddress);
      refresh();
    });

    return {setDelivery,refresh};
  };
})();
