
// Storage adapter: mantém compatibilidade com o ambiente original (window.storage)
// e adiciona fallback para localStorage quando o jogo roda como site independente.
const appStorage = {
  async get(key) {
    if (typeof window !== 'undefined' && window.storage?.get) return window.storage.get(key, false);
    if (typeof window !== 'undefined' && window.localStorage) {
      const value = window.localStorage.getItem(key);
      return value == null ? null : { value };
    }
    return null;
  },
  async set(key, value) {
    if (typeof window !== 'undefined' && window.storage?.set) return window.storage.set(key, value, false);
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
  },
  async delete(key) {
    if (typeof window !== 'undefined' && window.storage?.delete) return window.storage.delete(key, false);
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
  },
};


export { appStorage };
