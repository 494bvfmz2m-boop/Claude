(async function init() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('error-box');
  const loginBtn = document.getElementById('login-btn');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('visible');
  }

  // Already signed in? Skip straight to the dashboard.
  try {
    const sessionRes = await fetch('/auth/session');
    const sessionData = await sessionRes.json();
    if (sessionData.authenticated) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (err) {
    // ignore, fall through to login form
  }

  let csrfToken = null;
  try {
    const csrfRes = await fetch('/auth/csrf');
    ({ csrfToken } = await csrfRes.json());
  } catch (err) {
    showError('Could not reach the server. Refresh and try again.');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('visible');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, csrfToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Login failed.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
        return;
      }
      window.location.href = '/dashboard.html';
    } catch (err) {
      showError('Network error. Please try again.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
})();
