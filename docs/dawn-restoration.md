# Dawn foundation restoration

The current theme retained native JSON route templates but omitted their sections and transitive dependencies. Before repair, collection/product/page/search/blog/password routes referenced 13 missing section instances and layouts referenced three missing snippets/sections. Existing cart markup and search/password/localization placeholders also lacked the DOM contracts and behaviors expected by the existing Dawn JavaScript. This explains the incomplete native rendering foundation; live route responses have not been tested here.

## Authoritative source and scope

Restored from the user-supplied `theme_export__pixiepinks-shop-dawn__06OCT2026-1107am.zip`, extracted outside the checkout. No Shopify resources, menus, handles, products, collections, redirects, live themes, or publication state were changed.

Restored 121 previously absent files: 39 assets, 47 sections, 28 snippets, and seven customer templates. These include the full exported reusable section library, section-rendering endpoints, native forms, filters, pagination, cart notifications/drawer, media, quick-add, quantity controls, localization snippets, and accessibility icons. All SVG/icon dependencies already existed and were retained. `email-signup-banner.liquid` received the schema compatibility correction described below; the other 120 restored files match the export byte for byte.

## Existing files changed

- `assets/localization-form.js`: restore native country/language disclosure behavior; the custom header's inline select forms remain unchanged.
- `assets/password-modal.js`: restore DetailsModal behavior and invalid-password opening/focus handling.
- `assets/predictive-search.js`: restore requests, caching, keyboard interaction and live regions; use `.pp-header` as a height fallback when Dawn's `.section-header` is absent.
- `assets/section-password.css`, `assets/template-giftcard.css`: restore complete native page styling in place of one-line placeholders.
- `sections/main-cart-items.liquid`, `sections/main-cart-footer.liquid`: restore cart form IDs, section replacement containers, quantity/remove controls, discounts, notes and checkout contracts required by existing cart.js.
- `sections/cart-icon-bubble.liquid`, `sections/cart-live-region-text.liquid`: restore native section-response payloads and translation keys. Stable DOM target wrappers now live in the layout.
- `layout/theme.liquid`: retain custom styling/scripts, social links, chat bubble and section groups; load SearchForm independently of the inactive Dawn header; restore notification cart mode; add wrappers for native cart updates and load the custom-header count adapter.
- `locales/en.default.json`: remove only the redundant English-only `general.cart.cart` addition, restoring export content and eliminating mismatch errors in 31 locales.
- `locales/si.json`: retain every existing Sinhala translation and add 62 missing leaf entries from the English default locale as fallbacks. These still need human Sinhala translation; no Sinhala text was invented.
- `sections/pixiepinks-footer.liquid`: retain the existing layout and intended labels; replace two nonexistent translation keys with their existing fallback labels, and use `shop.privacy_policy.url` for the existing privacy link.

## Added integration and validation files

- `assets/pixiepinks-dawn-cart.js`: sync the unchanged custom header cart badge with native Dawn cart events and existing PixiePinks quick-add events.
- `scripts/audit_theme_dependencies.py`: audit all JSON templates (including customer templates), section groups, configured blocks, literal Liquid render/section dependencies, asset references including SVG/inline assets, and embedded schema JSON.
- `scripts/test_theme_runtime.cjs`: seven regression tests using real theme JavaScript with jsdom and mocked Shopify responses.

The restored password signup section used the obsolete top-level `templates` schema field. It is now expressed as `enabled_on.templates`, preserving password-only availability.

## Deliberately retained files

All existing files shared with the export were compared before editing. The intentional repository differences retained byte for byte are:

- `assets/base.css`: custom social/search styling and utility-bar placement.
- `assets/pubsub.js`: compact but behaviorally compatible native publish/subscribe implementation.
- `config/markets.json`, `config/settings_data.json`: current store/theme configuration.
- `sections/header-group.json`, `sections/footer-group.json`: custom PixiePinks groups remain active; restored Dawn header/footer sections are available but not activated.
- `snippets/meta-tags.liquid`: current SEO customization.
- `templates/index.json`: custom PixiePinks homepage.
- `templates/collection.json`, `templates/page.json`: current configurations, without reintroducing the export's extra collection lists or handles.

All pre-existing `sections/pixiepinks-*`, `snippets/pixiepinks-*` and `assets/pixiepinks-*` remain byte-identical except for the narrowly scoped footer correction above. In particular, the header and category navigation still use nested details/summary disclosures for parents, Shopify-provided URLs for leaves, and no manually constructed collection URLs. Existing PixiePinks CSS and JS remain byte-identical.

## Validation

- Shopify Theme Check: before 120 errors / 41 warnings; after 6 errors / 21 warnings. Its final exit status remains 1 because of the six third-party ParserBlockingScript lint findings. No missing section/template, schema, translation-key, or translation-matching errors remain. No checks were disabled.
- Existing `python3 scripts/validate_theme.py`: passed; custom homepage and section groups resolve and all 103 referenced CSS/JS assets exist.
- `python3 scripts/audit_theme_dependencies.py`: passed; 77 JSON files, 34 configured section instances, 135 Liquid files, 313 snippet references and 217 asset references; zero missing dependencies. Collection resolves main-collection-banner and main-collection-product-grid; product resolves main-product and related-products.
- JavaScript syntax: all 41 assets/*.js passed `node --check`.
- Seven runtime regression tests passed: native Add to Cart and rejected submissions; variant form IDs; quantity/removal section updates; predictive search with the custom header; country disclosure submission/Escape; custom header cart count; nested menu behavior. Shopify API responses are mocked; these are not live storefront/checkout tests.
- Git whitespace check passed; protected-file hashes verify preservation claims.

### Remaining lint and runtime limits

Six `ParserBlockingScript` errors are unchanged third-party BSS script_tag calls in `snippets/bss-product-label-js.liquid` and `snippets/bss-product-labels-configs.liquid`. Changing vendor script ordering is outside this structural repair.

Remaining 21 warnings: AssetPreload (6), OrphanedSnippet (5), UndefinedObject (5), VariableName (2), PaginationSize (1), UnusedAssign (1), LiquidComplexity (1). The BSS search pagination warning was present before repair. The native `offset: continue` warning is a valid Liquid loop construct. Other warnings are retained export/source lint findings and should be reviewed separately.

A live Shopify store preview, actual filtering/pagination responses, media playback, checkout and authentication-dependent behavior were not run. No preview upload or theme publication occurred. Review those behaviors in an unpublished development theme before deployment.

### Reproduce checks

```bash
cd /workspace/pixiepinks-copy-of-dawn
python3 scripts/validate_theme.py
python3 scripts/audit_theme_dependencies.py
# Node >=22.12.0; pinned tools live outside the checkout.
npm --cache /workspace/.cache/npm install --prefix /workspace/.tools/shopify --no-audit --no-fund @shopify/cli@4.8.4
npm --cache /workspace/.cache/npm install --prefix /workspace/.tools/theme-tests --no-audit --no-fund jsdom@26.1.0
NODE_PATH=/workspace/.tools/theme-tests/node_modules node --test scripts/test_theme_runtime.cjs
SHOPIFY_CLI_HOME=/workspace/.cache/shopify XDG_CONFIG_HOME=/workspace/.cache/config SHOPIFY_CLI_NO_ANALYTICS=1 /workspace/.tools/shopify/node_modules/.bin/shopify theme check --output json
```

## Restored file inventory

### assets (39)

- `assets/magnify.js`
- `assets/main-search.js`
- `assets/mask-blobs.css`
- `assets/media-gallery.js`
- `assets/newsletter-section.css`
- `assets/pickup-availability.js`
- `assets/price-per-item.js`
- `assets/product-form.js`
- `assets/product-info.js`
- `assets/product-modal.js`
- `assets/product-model.js`
- `assets/quantity-popover.css`
- `assets/quantity-popover.js`
- `assets/quick-add.css`
- `assets/quick-add.js`
- `assets/quick-order-list.css`
- `assets/quick-order-list.js`
- `assets/recipient-form.js`
- `assets/search-form.js`
- `assets/section-blog-post.css`
- `assets/section-collection-list.css`
- `assets/section-contact-form.css`
- `assets/section-email-signup-banner.css`
- `assets/section-featured-blog.css`
- `assets/section-featured-product.css`
- `assets/section-footer.css`
- `assets/section-image-banner.css`
- `assets/section-main-blog.css`
- `assets/section-main-page.css`
- `assets/section-main-product.css`
- `assets/section-multicolumn.css`
- `assets/section-related-products.css`
- `assets/section-rich-text.css`
- `assets/share.js`
- `assets/show-more.js`
- `assets/sparkle.gif`
- `assets/template-collection.css`
- `assets/theme-editor.js`
- `assets/video-section.css`

### sections (47)

- `sections/announcement-bar.liquid`
- `sections/apps.liquid`
- `sections/cart-drawer.liquid`
- `sections/cart-notification-button.liquid`
- `sections/cart-notification-product.liquid`
- `sections/collage.liquid`
- `sections/collapsible-content.liquid`
- `sections/collection-list.liquid`
- `sections/contact-form.liquid`
- `sections/custom-liquid.liquid`
- `sections/email-signup-banner.liquid`
- `sections/featured-blog.liquid`
- `sections/featured-collection.liquid`
- `sections/featured-product.liquid`
- `sections/footer.liquid`
- `sections/header.liquid`
- `sections/image-banner.liquid`
- `sections/image-with-text.liquid`
- `sections/main-404.liquid`
- `sections/main-account.liquid`
- `sections/main-activate-account.liquid`
- `sections/main-addresses.liquid`
- `sections/main-article.liquid`
- `sections/main-blog.liquid`
- `sections/main-collection-banner.liquid`
- `sections/main-collection-product-grid.liquid`
- `sections/main-list-collections.liquid`
- `sections/main-login.liquid`
- `sections/main-order.liquid`
- `sections/main-page.liquid`
- `sections/main-password-footer.liquid`
- `sections/main-password-header.liquid`
- `sections/main-product.liquid`
- `sections/main-register.liquid`
- `sections/main-reset-password.liquid`
- `sections/main-search.liquid`
- `sections/multicolumn.liquid`
- `sections/multirow.liquid`
- `sections/newsletter.liquid`
- `sections/page.liquid`
- `sections/pickup-availability.liquid`
- `sections/predictive-search.liquid`
- `sections/quick-order-list.liquid`
- `sections/related-products.liquid`
- `sections/rich-text.liquid`
- `sections/slideshow.liquid`
- `sections/video.liquid`

### snippets (28)

- `snippets/article-card.liquid`
- `snippets/buy-buttons.liquid`
- `snippets/card-collection.liquid`
- `snippets/card-product.liquid`
- `snippets/cart-drawer.liquid`
- `snippets/cart-notification.liquid`
- `snippets/country-localization.liquid`
- `snippets/facets.liquid`
- `snippets/gift-card-recipient-form.liquid`
- `snippets/header-drawer.liquid`
- `snippets/header-dropdown-menu.liquid`
- `snippets/header-mega-menu.liquid`
- `snippets/header-search.liquid`
- `snippets/icon-accordion.liquid`
- `snippets/icon-with-text.liquid`
- `snippets/language-localization.liquid`
- `snippets/pagination.liquid`
- `snippets/price.liquid`
- `snippets/product-media-gallery.liquid`
- `snippets/product-media-modal.liquid`
- `snippets/product-media.liquid`
- `snippets/product-thumbnail.liquid`
- `snippets/product-variant-options.liquid`
- `snippets/product-variant-picker.liquid`
- `snippets/quantity-input.liquid`
- `snippets/quick-order-list-row.liquid`
- `snippets/share-button.liquid`
- `snippets/social-icons.liquid`

### templates (7)

- `templates/customers/account.json`
- `templates/customers/activate_account.json`
- `templates/customers/addresses.json`
- `templates/customers/login.json`
- `templates/customers/order.json`
- `templates/customers/register.json`
- `templates/customers/reset_password.json`
