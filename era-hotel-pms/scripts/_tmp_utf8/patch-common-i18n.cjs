const fs = require('fs');
const path = require('path');

const locales = {
  en: { filterApply: 'Apply', filterReset: 'Reset', required: 'Required', saved: 'Saved' },
  az: { filterApply: 'Tetbiq et', filterReset: 'Sifirla', required: 'Mecburi', saved: 'Saxlanildi' },
  ru: { filterApply: 'Primenit', filterReset: 'Sbrosit', required: 'Obyazatelno', saved: 'Sohraneno' },
};

// Proper unicode via JSON unicode escapes below after write - rewrite properly
