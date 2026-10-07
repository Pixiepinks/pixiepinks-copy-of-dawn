// Keep the custom header count in sync with native Dawn and PixiePinks quick-add.
(() => {
  let refreshVersion = 0;

  async function refreshCount(cartData) {
    const version = ++refreshVersion;
    try {
      const cart = typeof cartData?.item_count === 'number'
        ? cartData
        : await fetch(`${window.routes.cart_url}.js`, { headers: { Accept: 'application/json' } })
          .then((response) => {
            if (!response.ok) throw new Error('Unable to refresh cart count');
            return response.json();
          });
      if (version !== refreshVersion) return;
      document.querySelectorAll('.pp-header-actions a').forEach((link) => {
        if (new URL(link.href).pathname !== new URL(window.routes.cart_url, window.location.origin).pathname) return;
        const count = link.querySelector('b');
        if (count) count.textContent = cart.item_count;
        link.setAttribute('aria-label', `Cart, ${cart.item_count} items`);
      });
      return cart;
    } catch (error) {
      console.error(error);
    }
  }

  subscribe(PUB_SUB_EVENTS.cartUpdate, ({ cartData }) => refreshCount(cartData));
  document.addEventListener('cart:refresh', async () => {
    const cartData = await refreshCount();
    if (cartData) publish(PUB_SUB_EVENTS.cartUpdate, { source: 'pixiepinks-quick-add', cartData });
  });
})();
