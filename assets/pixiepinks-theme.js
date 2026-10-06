class PixiePinksCarousel extends HTMLElement {
  connectedCallback() {
    this.slides = [...this.querySelectorAll('[data-pp-slide]')];
    if (this.slides.length < 2) return;
    this.index = Math.max(0, this.slides.findIndex((slide) => slide.getAttribute('aria-hidden') !== 'true'));
    this.dots = [...this.querySelectorAll('[data-pp-dot]')];
    this.querySelector('[data-pp-prev]')?.addEventListener('click', () => this.show(this.index - 1, true));
    this.querySelector('[data-pp-next]')?.addEventListener('click', () => this.show(this.index + 1, true));
    this.dots.forEach((dot, index) => dot.addEventListener('click', () => this.show(index, true)));
    this.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.show(this.index - 1, true);
      if (event.key === 'ArrowRight') this.show(this.index + 1, true);
    });
    let startX = 0;
    this.addEventListener('pointerdown', (event) => { startX = event.clientX; this.pause(); }, { passive: true });
    this.addEventListener('pointerup', (event) => {
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 45) this.show(this.index + (distance < 0 ? 1 : -1), true);
    }, { passive: true });
    this.addEventListener('mouseenter', () => this.pause());
    this.addEventListener('focusin', () => this.pause());
    this.start();
  }
  show(index, userInitiated = false) {
    this.index = (index + this.slides.length) % this.slides.length;
    this.slides.forEach((slide, i) => { slide.setAttribute('aria-hidden', String(i !== this.index)); slide.toggleAttribute('inert', i !== this.index); });
    this.dots.forEach((dot, i) => { dot.setAttribute('aria-current', String(i === this.index)); });
    if (userInitiated) this.pause();
  }
  start() {
    const delay = Number(this.dataset.autoplay);
    if (!delay || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => this.show(this.index + 1), delay);
  }
  pause() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  disconnectedCallback() { this.pause(); }
}
customElements.define('pp-carousel', PixiePinksCarousel);

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('.pp-menu-toggle');
  if (!toggle) return;
  const menu = document.getElementById(toggle.getAttribute('aria-controls'));
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  menu?.classList.toggle('is-open', open);
});

document.addEventListener('toggle', (event) => {
  const details = event.target.closest('.pp-nav-details');
  if (!details) return;
  details.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(details.open));
  if (!details.open) return;
  const siblings = details.parentElement?.parentElement?.querySelectorAll(':scope > li > .pp-nav-details[open]');
  siblings?.forEach((sibling) => {
    if (sibling !== details) sibling.removeAttribute('open');
  });
}, true);

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-pp-quick-add]');
  if (!form || !window.fetch) return;
  event.preventDefault();
  const button = form.querySelector('button');
  const original = button.textContent;
  button.disabled = true; button.textContent = 'Adding…';
  try {
    const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    if (!response.ok) throw new Error('Unable to add item');
    button.textContent = 'Added!';
    document.dispatchEvent(new CustomEvent('cart:refresh'));
  } catch (error) { button.textContent = 'Try again'; }
  finally { setTimeout(() => { button.disabled = false; button.textContent = original; }, 1400); }
});
