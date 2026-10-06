// Run with Node's test runner and jsdom 26.1.0 available through NODE_PATH.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInContext } = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = join(__dirname, '..');
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function page(html) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => errors.push(error));
  console.on('error', (error) => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://example.test/products/example', runScripts: 'outside-only', virtualConsole: console });
  const window = dom.window;
  window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  window.routes = { cart_add_url: '/cart/add.js', cart_change_url: '/cart/change.js', cart_update_url: '/cart/update.js', cart_url: '/cart', predictive_search_url: '/search/suggest' };
  window.cartStrings = { error: 'Cart error', quantityError: 'Only [quantity] available' };
  // Separate classic scripts share global lexical bindings in real browsers.
  const load = (file) => runInContext(readFileSync(join(root, 'assets', file), 'utf8'), dom.getInternalVMContext(), { filename: file });
  load('constants.js'); load('pubsub.js'); load('global.js');
  return { dom, window, load, errors };
}

test('native product form sends variant, quantity and requested sections; errors remain visible', async () => {
  const { dom, window: w, load, errors } = page(`<cart-notification></cart-notification><product-form><form><input name="id" value="202" disabled><input name="quantity" value="2"><button type="submit"><span>Add to cart</span></button><div class="loading-overlay__spinner hidden"></div><div class="product-form__error-message-wrapper" hidden><span class="product-form__error-message"></span></div></form></product-form>`);
  const cart = w.document.querySelector('cart-notification');
  let rendered, request, reject = false;
  cart.getSectionsToRender = () => [{ id: 'cart-notification-product' }, { id: 'cart-icon-bubble' }];
  cart.setActiveElement = () => {};
  cart.renderContents = (data) => { rendered = data; };
  w.fetch = async (url, config) => { request = { url, config }; return { json: async () => reject ? { status: 422, description: 'Sold out' } : { id: 202, key: '202:key', sections: {} } }; };
  load('product-form.js');
  const form = w.document.querySelector('form');
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(request.url, '/cart/add.js');
  assert.equal(request.config.body.get('id'), '202');
  assert.equal(request.config.body.get('quantity'), '2');
  assert.equal(request.config.body.get('sections'), 'cart-notification-product,cart-icon-bubble');
  assert.equal(rendered.id, 202);
  assert.equal(form.querySelector('button').hasAttribute('aria-disabled'), false);
  reject = true;
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(w.document.querySelector('.product-form__error-message').textContent, 'Sold out');
  assert.equal(w.document.querySelector('.product-form__error-message-wrapper').hidden, false);
  assert.deepEqual(errors, []); dom.window.close();
});

test('native variants synchronize product and installment form IDs', () => {
  const { dom, window: w, errors } = page(`<variant-selects data-section="product"><select><option>Red</option><option selected>Blue</option></select><script type="application/json">[{"id":101,"options":["Red"]},{"id":202,"options":["Blue"]}]</script></variant-selects><form id="product-form-product"><input name="id" value="101"></form><form id="product-form-installment-product"><input name="id" value="101"></form>`);
  const picker = w.document.querySelector('variant-selects');
  picker.updateOptions(); picker.updateMasterId(); picker.updateVariantInput();
  assert.equal(picker.currentVariant.id, 202);
  assert.deepEqual([...w.document.querySelectorAll('input[name="id"]')].map((input) => input.value), ['202', '202']);
  assert.deepEqual(errors, []); dom.window.close();
});

test('cart quantity and removal replace native section payloads without losing status targets', async () => {
  const markup = (quantity) => `<div class="js-contents"><div class="cart-item" id="CartItem-1"><input id="Quantity-1" name="updates[]" value="${quantity}" data-index="1"><div class="loading-overlay hidden"></div><div id="Line-item-error-1"><span class="cart-item__error-text"></span></div></div></div>`;
  const { dom, window: w, load, errors } = page(`<cart-items><div id="shopping-cart-line-item-status"></div><div id="main-cart-items" data-id="items">${markup(1)}</div><div id="cart-errors"></div></cart-items><div id="main-cart-footer" data-id="footer"><div class="js-contents">Old total</div></div><div id="cart-icon-bubble"></div><div id="cart-live-region-text"></div>`);
  let request;
  w.fetch = async (url, config) => {
    request = { url, body: JSON.parse(config.body) };
    const quantity = request.body.quantity;
    return { text: async () => JSON.stringify({ item_count: quantity, items: quantity ? [{ quantity }] : [], sections: { items: `<div>${markup(quantity)}</div>`, footer: '<div class="js-contents">New total</div>', 'cart-icon-bubble': `<div class="shopify-section">${quantity}</div>`, 'cart-live-region-text': '<div class="shopify-section">New estimated total</div>' } }) };
  };
  load('cart.js');
  const items = w.document.querySelector('cart-items');
  items.updateQuantity(1, 2, 'updates[]', 202); await settle();
  assert.equal(request.url, '/cart/change.js');
  assert.deepEqual(request.body.sections, ['items', 'cart-icon-bubble', 'cart-live-region-text', 'footer']);
  assert.equal(w.document.querySelector('#Quantity-1').value, '2');
  assert.equal(w.document.querySelector('#cart-icon-bubble').textContent, '2');
  assert.equal(w.document.querySelector('#main-cart-footer').textContent, 'New total');
  items.updateQuantity(1, 0, 'updates[]', 202); await settle();
  assert.equal(items.classList.contains('is-empty'), true);
  assert.equal(w.document.querySelector('#cart-icon-bubble').textContent, '0');
  assert.equal(w.document.querySelector('#cart-live-region-text').getAttribute('aria-hidden'), 'false');
  assert.deepEqual(errors, []); dom.window.close();
});

test('predictive search fetches results and opens with the PixiePinks header', async () => {
  const { dom, window: w, load, errors } = page(`<div class="pp-header"></div><predictive-search data-loading-text="Loading"><form><input type="search" value="bike"><button type="reset" class="hidden">Reset</button><div data-predictive-search></div><span class="predictive-search-status"></span></form></predictive-search>`);
  w.document.querySelector('.pp-header').getBoundingClientRect = () => ({ bottom: 100 });
  let url;
  w.fetch = async (request) => { url = request; return { ok: true, text: async () => '<div id="shopify-section-predictive-search"><span data-predictive-search-live-region-count-value>1 result</span><ul><li role="option" aria-selected="false"><a href="/products/bike">Bike</a></li></ul></div>' }; };
  load('search-form.js'); load('predictive-search.js');
  const search = w.document.querySelector('predictive-search');
  search.getSearchResults('bike'); await settle();
  assert.equal(url, '/search/suggest?q=bike&section_id=predictive-search');
  assert.equal(search.hasAttribute('open'), true);
  assert.equal(search.getResultsMaxHeight(), w.innerHeight - 100);
  assert.equal(search.querySelector('.predictive-search-status').textContent, '1 result');
  assert.deepEqual(errors, []); dom.window.close();
});

test('native localization disclosure submits selected country and closes on Escape', () => {
  const { dom, window: w, load, errors } = page(`<localization-form><form><input name="country_code" value="LK"><button type="button" aria-expanded="false">Country</button><div class="disclosure__list-wrapper" hidden><a data-value="US" href="#">US</a></div></form></localization-form>`);
  let submitted = false;
  const form = w.document.querySelector('form'); form.submit = () => { submitted = true; };
  load('localization-form.js');
  const button = form.querySelector('button'); button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  form.querySelector('a').click();
  assert.equal(form.querySelector('input').value, 'US'); assert.equal(submitted, true);
  form.querySelector('a').dispatchEvent(new w.KeyboardEvent('keyup', { bubbles: true, code: 'Escape' }));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(errors, []); dom.window.close();
});

test('custom header count follows native cart events and existing homepage quick-add', async () => {
  const { dom, window: w, load, errors } = page('<div class="pp-header-actions"><a href="/cart" aria-label="Cart, 0 items"><b>0</b></a></div>');
  w.fetch = async (url) => { assert.equal(url, '/cart.js'); return { ok: true, json: async () => ({ item_count: 3 }) }; };
  load('pixiepinks-dawn-cart.js');
  w.eval("publish(PUB_SUB_EVENTS.cartUpdate, {cartData: {item_count: 2}})"); await settle();
  assert.equal(w.document.querySelector('b').textContent, '2');
  w.document.dispatchEvent(new w.CustomEvent('cart:refresh')); await settle();
  assert.equal(w.document.querySelector('b').textContent, '3');
  assert.equal(w.document.querySelector('a').getAttribute('aria-label'), 'Cart, 3 items');
  assert.deepEqual(errors, []); dom.window.close();
});

test('PixiePinks nested menus keep disclosure controls and close sibling groups', async () => {
  const header = readFileSync(join(root, 'sections/pixiepinks-header.liquid'), 'utf8');
  assert.match(header, /if link.links != blank[\s\S]*?<summary/);
  assert.match(header, /if child.links != blank[\s\S]*?<summary/);
  assert.doesNotMatch(header, /\/collections\//);
  const { dom, window: w, load, errors } = page('<ul><li><details class="pp-nav-details"><summary aria-expanded="false">Parent</summary><ul><li><details class="pp-nav-details"><summary aria-expanded="false">Child</summary><a href="/products/example">Leaf</a></details></li></ul></details></li><li><details class="pp-nav-details"><summary aria-expanded="false">Sibling</summary></details></li></ul>');
  load('pixiepinks-theme.js');
  const [parent, child, sibling] = w.document.querySelectorAll('details');
  parent.open = true; await settle(); child.open = true; await settle();
  assert.equal(parent.open, true); assert.equal(child.querySelector('summary').getAttribute('aria-expanded'), 'true');
  sibling.open = true; await settle();
  assert.equal(parent.open, false); assert.equal(sibling.open, true);
  assert.deepEqual(errors, []); dom.window.close();
});
