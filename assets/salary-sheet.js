(function () {
  const STORAGE_VERSION = 'salary-sheet:v1';

  const FIELD_MAP = {
    basicSalary: 'basic_salary',
    generalAllowance: 'general_allowance',
    transportAllowance: 'transport_allowance',
    specialAllowance: 'special_allowance',
    attendance: 'attendance',
    overtime: 'overtime',
    productionTargetAllowance: 'production_target_allowance',
    remarks: 'remarks',
  };

  function parseMonth(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (Number.isNaN(year) || Number.isNaN(month)) return null;
    return new Date(Date.UTC(year, month - 1));
  }

  class SalaryStorage {
    constructor(storageKey) {
      this.storageKey = storageKey || STORAGE_VERSION;
    }

    _load() {
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        console.warn('[salary-sheet] Failed to parse saved data', error);
        return {};
      }
    }

    _save(payload) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    }

    _ensureEmployee(data, employeeId) {
      if (!data[employeeId]) {
        data[employeeId] = [];
      }
      return data[employeeId];
    }

    getAll() {
      return this._load();
    }

    getEntries(employeeId) {
      if (!employeeId) return [];
      const data = this._load();
      const entries = data[employeeId];
      if (!Array.isArray(entries)) return [];
      return entries
        .slice()
        .sort((a, b) => {
          const aDate = parseMonth(a.month) || new Date(0);
          const bDate = parseMonth(b.month) || new Date(0);
          return aDate - bDate;
        });
    }

    getEntry(employeeId, month) {
      if (!employeeId || !month) return null;
      const entries = this.getEntries(employeeId);
      return entries.find((entry) => entry.month === month) || null;
    }

    getLatest(employeeId) {
      const entries = this.getEntries(employeeId);
      return entries.length ? entries[entries.length - 1] : null;
    }

    getLatestBefore(employeeId, month) {
      const targetDate = parseMonth(month);
      const entries = this.getEntries(employeeId);
      if (!entries.length) return null;
      if (!targetDate) return entries[entries.length - 1];

      let candidate = null;
      entries.forEach((entry) => {
        const entryDate = parseMonth(entry.month);
        if (!entryDate) return;
        if (entryDate >= targetDate) return;
        if (!candidate) {
          candidate = entry;
          return;
        }
        const candidateDate = parseMonth(candidate.month);
        if (candidateDate && entryDate > candidateDate) {
          candidate = entry;
        }
      });

      if (!candidate) {
        return entries[entries.length - 1];
      }

      return candidate;
    }

    saveEntry(employeeId, entry) {
      if (!employeeId || !entry || !entry.month) {
        throw new Error('employeeId and month are required to save a salary entry.');
      }
      const data = this._load();
      const entries = this._ensureEmployee(data, employeeId);
      const existingIndex = entries.findIndex((item) => item.month === entry.month);
      if (existingIndex >= 0) {
        entries[existingIndex] = Object.assign({}, entries[existingIndex], entry);
      } else {
        entries.push(entry);
      }
      entries.sort((a, b) => {
        const aDate = parseMonth(a.month) || new Date(0);
        const bDate = parseMonth(b.month) || new Date(0);
        return aDate - bDate;
      });
      this._save(data);
      return entry;
    }
  }

  class SalarySheetController {
    constructor(root) {
      this.root = root;
      this.storage = new SalaryStorage(root.dataset.storageKey || STORAGE_VERSION);
      this.modal = root.querySelector('[data-salary-modal]');
      this.form = this.modal ? this.modal.querySelector('[data-salary-form]') : null;
      this.monthInput = this.form ? this.form.querySelector('[data-field="month"]') : null;
      this.employeeMeta = this.modal ? this.modal.querySelector('[data-salary-employee]') : null;
      this.currentEmployeeId = null;
      this.currentEmployeeName = null;
      this.currentRow = null;
      this._attachEventListeners();
      this._renderRowsFromStorage();
    }

    _attachEventListeners() {
      if (!this.root) return;
      this.root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-salary-open]');
        if (!button) return;
        event.preventDefault();
        const row = button.closest('[data-salary-row]');
        const employeeId = row ? row.dataset.employeeId : button.dataset.employeeId;
        const employeeName = row ? row.dataset.employeeName : button.dataset.employeeName;
        this.openModal(employeeId, employeeName, row);
      });

      if (this.form) {
        this.form.addEventListener('submit', (event) => {
          event.preventDefault();
          this._handleSubmit();
        });
        this.form.querySelectorAll('[data-field]').forEach((input) => {
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
              this.closeModal();
            }
          });
        });
      }

      if (this.monthInput) {
        this.monthInput.addEventListener('change', () => {
          this._prefillForCurrentContext();
        });
      }

      const closeButton = this.modal ? this.modal.querySelector('[data-salary-close]') : null;
      if (closeButton) {
        closeButton.addEventListener('click', () => this.closeModal());
      }

      if (this.modal) {
        this.modal.addEventListener('click', (event) => {
          if (event.target === this.modal) {
            this.closeModal();
          }
        });
      }
    }

    _renderRowsFromStorage() {
      const rows = this.root.querySelectorAll('[data-salary-row]');
      rows.forEach((row) => {
        const employeeId = row.dataset.employeeId;
        const latest = this.storage.getLatest(employeeId);
        if (latest) {
          this._writeRow(row, latest);
        } else {
          this._writeRow(row, {
            basicSalary: row.dataset.initialBasicSalary,
            generalAllowance: row.dataset.initialGeneralAllowance,
            transportAllowance: row.dataset.initialTransportAllowance,
            specialAllowance: row.dataset.initialSpecialAllowance,
            attendance: '',
            overtime: '',
            productionTargetAllowance: '',
          });
        }
      });
    }

    _writeRow(row, entry) {
      const cells = {
        basicSalary: row.querySelector('[data-cell="basic_salary"]'),
        generalAllowance: row.querySelector('[data-cell="general_allowance"]'),
        transportAllowance: row.querySelector('[data-cell="transport_allowance"]'),
        specialAllowance: row.querySelector('[data-cell="special_allowance"]'),
        attendance: row.querySelector('[data-cell="attendance"]'),
        overtime: row.querySelector('[data-cell="overtime"]'),
        productionTargetAllowance: row.querySelector('[data-cell="production_target_allowance"]'),
      };

      Object.entries(cells).forEach(([key, cell]) => {
        if (!cell) return;
        let value = entry[key];
        if (value === undefined || value === null || value === '') {
          if (['basicSalary', 'generalAllowance', 'transportAllowance', 'specialAllowance'].includes(key)) {
            value = '—';
          } else {
            value = '';
          }
        }
        if (typeof value === 'number' && !Number.isNaN(value)) {
          const hasDecimals = Math.abs(value % 1) > 0;
          value = value.toLocaleString(undefined, {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: hasDecimals ? 2 : 0,
          });
        }
        cell.textContent = value;
        cell.dataset.value = entry[key] ?? '';
      });
    }

    openModal(employeeId, employeeName, row) {
      if (!employeeId || !this.modal) return;
      this.currentEmployeeId = employeeId;
      this.currentEmployeeName = employeeName || employeeId;
      this.currentRow = row || null;

      if (this.employeeMeta) {
        this.employeeMeta.querySelector('[data-salary-employee-name]').textContent = this.currentEmployeeName;
        this.employeeMeta.querySelector('[data-salary-employee-id]').textContent = this.currentEmployeeId;
      }

      if (this.monthInput && !this.monthInput.value) {
        this.monthInput.value = this._currentMonthString();
      }

      this._prefillForCurrentContext();

      this.modal.removeAttribute('hidden');
      const firstField = this.form ? this.form.querySelector('[data-field]:not([data-field="month"])') : null;
      if (firstField) {
        firstField.focus({ preventScroll: false });
      }
    }

    closeModal() {
      if (!this.modal) return;
      this.modal.setAttribute('hidden', 'hidden');
      this.currentEmployeeId = null;
      this.currentEmployeeName = null;
      this.currentRow = null;
      if (this.form) {
        this.form.reset();
      }
    }

    _prefillForCurrentContext() {
      if (!this.currentEmployeeId || !this.form) return;
      const month = this.monthInput ? this.monthInput.value : null;
      const existing = this.storage.getEntry(this.currentEmployeeId, month);
      if (existing) {
        this._writeForm(existing);
        return;
      }
      const latest = this.storage.getLatestBefore(this.currentEmployeeId, month);
      if (latest) {
        this._writeForm(latest, { carryOnlyAllowances: true });
        return;
      }

      const row = this.currentRow;
      if (row) {
        this._writeForm(
          {
            basicSalary: row.dataset.initialBasicSalary,
            generalAllowance: row.dataset.initialGeneralAllowance,
            transportAllowance: row.dataset.initialTransportAllowance,
            specialAllowance: row.dataset.initialSpecialAllowance,
          },
          { carryOnlyAllowances: true }
        );
      } else {
        this._clearForm();
      }
    }

    _writeForm(entry, options = {}) {
      if (!this.form) return;
      const { carryOnlyAllowances = false } = options;
      Object.entries(FIELD_MAP).forEach(([key, fieldName]) => {
        const input = this.form.querySelector(`[data-field="${fieldName}"]`);
        if (!input) return;
        if (
          carryOnlyAllowances &&
          !['basicSalary', 'generalAllowance', 'transportAllowance', 'specialAllowance'].includes(key)
        ) {
          input.value = '';
          return;
        }
        const value = entry[key];
        input.value = value !== undefined && value !== null ? value : '';
      });
      if (this.monthInput && entry.month && !carryOnlyAllowances) {
        this.monthInput.value = entry.month;
      }
    }

    _clearForm() {
      if (!this.form) return;
      Object.values(FIELD_MAP).forEach((fieldName) => {
        const input = this.form.querySelector(`[data-field="${fieldName}"]`);
        if (input) input.value = '';
      });
    }

    _collectFormData() {
      if (!this.form) return null;
      const result = {};
      Object.entries(FIELD_MAP).forEach(([key, fieldName]) => {
        const input = this.form.querySelector(`[data-field="${fieldName}"]`);
        if (!input) return;
        if (input.type === 'number') {
          const value = input.value.trim();
          result[key] = value === '' ? '' : Number(value);
        } else {
          result[key] = input.value.trim();
        }
      });
      const month = this.monthInput ? this.monthInput.value : null;
      if (month) {
        result.month = month;
      }
      return result;
    }

    _handleSubmit() {
      if (!this.currentEmployeeId) return;
      const formData = this._collectFormData();
      if (!formData || !formData.month) {
        alert('Please choose a month for this salary entry.');
        return;
      }
      try {
        this.storage.saveEntry(this.currentEmployeeId, formData);
        const updatedEntry = this.storage.getEntry(this.currentEmployeeId, formData.month);
        if (this.currentRow && updatedEntry) {
          this._writeRow(this.currentRow, updatedEntry);
        }
        this.closeModal();
      } catch (error) {
        console.error('[salary-sheet] Failed to save salary entry', error);
        alert('Unable to save salary entry. Please try again.');
      }
    }

    _currentMonthString() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  }

  function initSalarySheets() {
    const roots = document.querySelectorAll('[data-salary-sheet]');
    if (!roots.length) return;
    roots.forEach((root) => {
      if (root.__salarySheetController) return;
      root.__salarySheetController = new SalarySheetController(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSalarySheets);
  } else {
    initSalarySheets();
  }
})();
