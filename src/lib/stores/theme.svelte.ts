const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('deepvis-theme') as 'dark' | 'light' | null)
  : null;

let theme = $state<'dark' | 'light'>(stored ?? 'dark');

export const themeStore = {
  get theme() { return theme; },
  toggle() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('deepvis-theme', theme);
  },
};
