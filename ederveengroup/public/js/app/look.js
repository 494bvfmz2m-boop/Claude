// EderveenGroup client: look
import { state } from './state.js';
import { $, api, toast } from './util.js';

// phones have their own look (Apple-style, light unless you choose otherwise)
const phoneQuery = matchMedia('(max-width: 760px)');
const isPhone = () => phoneQuery.matches;
const themeKey = () => (isPhone() ? 'phoneTheme' : 'theme');

function applyLook() {
    const s = state.settings;
    const root = document.documentElement;
    const chosen = s[themeKey()] || (isPhone() ? 'light' : 'dark');
    const theme = chosen === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : chosen;
    root.dataset.theme = theme;
    root.dataset.device = isPhone() ? 'phone' : 'desk';
    root.dataset.density = s.density;
    $('#app').classList.toggle('pane-off', s.readingPane === 'off');
    window.egApplyAccent(s.accent);
    $('meta[name=theme-color]').content = isPhone() ? (theme === 'light' ? '#f2f2f7' : '#000000') : theme === 'light' ? '#eef1fb' : '#04050b';
    $('#theme-btn').innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
    try {
        localStorage.setItem('eg.look', JSON.stringify({ theme: s.theme, phoneTheme: s.phoneTheme, accent: s.accent, density: s.density }));
    } catch {
        // private mode
    }
}

const saveSettings = async patch => {
    Object.assign(state.settings, patch);
    applyLook();
    try {
        state.settings = await api('api/settings', { method: 'PUT', body: patch });
        return true;
    } catch (e) {
        toast(e.message, { error: true });
        return false;
    }
};

// turning the phone sideways or resizing the window can switch between the two looks
phoneQuery.addEventListener('change', () => state.settings && applyLook());

export { applyLook, isPhone, saveSettings, themeKey };
