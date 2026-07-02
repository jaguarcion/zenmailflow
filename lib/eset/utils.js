/**
 * @param {string[]} [names] Translations
 * @param {string} [base] Base selector
 */
export const i18nText = (names = [], base = '') => 
  names
    .reduce((acc, name) => {
      const words = name.split(' ');
      if (words.length > 0) {
        acc.push(
          words.map(w => w.length > 0 ? (w[0].toLowerCase() + w.slice(1)) : w).join(' ')
        );
        acc.push(
          words.map(w => w.length > 0 ? (w[0].toUpperCase() + w.slice(1)) : w).join(' ')
        );
        acc.push(name.toLowerCase());
        acc.push(name.toUpperCase());
      }
      return acc;
    }, [])
    .map(name => `${base}::-p-text(${name})`).join(', ');
