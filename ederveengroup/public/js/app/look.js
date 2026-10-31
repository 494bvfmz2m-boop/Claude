// EderveenGroup client: look
import { state } from './state.js';
import { $, api, toast } from './util.js';

function applyLook() {
    const s = state.settings;
    const root = document.documentElement;
    const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
    root.dataset.theme = theme;
    root.dataset.density = s.density;
    $('#app').classList.toggle('pane-off', s.readingPane === 'off');
    window.egApplyAccent(s.accent);
    $('meta[name=theme-color]').content = theme === 'light' ? '#eef1f6' : '#0b0d12';
    $('#theme-btn').innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
    try {
        localStorage.setItem('eg.look', JSON.stringify({ theme: s.theme, accent: s.accent, density: s.density }));
    } catch {
        // private mode
    }
}

const saveSettings = async patch => {
    Object.assign(state.settings, patch);
    applyLook();
    try {
        state.settings = await api('api/settings', { method: 'PUT', body: patch });
    } catch (e) {
        toast(e.message, { error: true });
    }
};

export { applyLook, saveSettings };
