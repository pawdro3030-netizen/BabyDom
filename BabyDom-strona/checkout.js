const money = n =>
  n.toLocaleString('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  });

const cart = JSON.parse(
  localStorage.getItem('babydom-cart') || '[]'
);

const delivery =
  localStorage.getItem('babydom-delivery') || 'paczkomat';

const subtotal = cart.reduce(
  (sum, item) => sum + item.price * item.qty,
  0
);

const shipping =
  subtotal >= 149
    ? 0
    : delivery === 'kurier'
      ? 15.99
      : 12.99;

const total = subtotal + shipping;

if (!cart.length) {
  location.href = 'index.html#produkty';
} else {
  document.querySelector('#order-items').innerHTML =
    cart.map(item => `
      <div class="summary-item">
        <span>
          ${item.name}
          <small>${item.qty} × ${money(item.price)}</small>
        </span>
        <b>${money(item.qty * item.price)}</b>
      </div>
    `).join('') +
    `
      <div class="summary-item">
        <span>${delivery === 'kurier' ? 'Kurier' : 'Paczkomat'}</span>
        <b>${shipping ? money(shipping) : 'Gratis'}</b>
      </div>
    `;

  document.querySelector('#order-total').textContent = money(total);

  document.querySelector('#delivery-info').textContent =
    `${delivery === 'kurier'
      ? 'Kurier 15,99 zł'
      : 'Paczkomat 12,99 zł'
    }${shipping === 0 ? ' — dostawa bezpłatna' : ''}. ` +
    `Wysyłka we wtorki i piątki.`;

  const form = document.querySelector('#order-form');
  const submitButton = form.querySelector('button[type="submit"]');

  form.onsubmit = async e => {
    e.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);

    const customer = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      street: formData.get('street'),
      postalCode: formData.get('postcode'),
      city: formData.get('city')
    };

    const items = cart.map(item => ({
      id: item.id,
      qty: item.qty
    }));

    const oldButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = 'Przekierowujemy do płatności...';

    try {
      const response = await fetch('/api/p24-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer,
          items,
          delivery
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('P24 register error:', data);

        throw new Error(
          data.error || 'Nie udało się utworzyć płatności.'
        );
      }

      if (!data.redirectUrl) {
        throw new Error(
          'Serwer nie zwrócił adresu płatności.'
        );
      }

      localStorage.setItem(
        'babydom-last-order',
        JSON.stringify({
          sessionId: data.sessionId,
          orderNumber: data.orderNumber
        })
      );

      window.location.href = data.redirectUrl;

    } catch (error) {
      console.error(error);

      alert(
        'Nie udało się rozpocząć płatności. ' +
        'Spróbuj ponownie za chwilę.'
      );

      submitButton.disabled = false;
      submitButton.textContent = oldButtonText;
    }
  };
}
