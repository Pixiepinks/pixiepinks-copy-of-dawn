class LocalizationForm extends HTMLElement { connectedCallback() { this.querySelectorAll('select').forEach((select) => select.addEventListener('change', () => this.closest('form')?.submit())); } }
customElements.define('localization-form', LocalizationForm);
