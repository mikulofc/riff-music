import { login, register, getGoogleAuthUrl } from '../api';
import { navigate } from '../router';

export function renderLoginPage(container: HTMLElement, onLogin: () => void): void {
  let isRegister = false;

  function render() {
    container.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h1>Riff Music</h1>
          <p class="login-subtitle">${isRegister ? 'Create an account' : 'Sign in to your library'}</p>
          <div id="login-error" class="login-error" style="display:none"></div>
          <div id="login-success" class="login-success" style="display:none"></div>
          <form id="auth-form">
            ${isRegister ? '<input type="text" id="auth-name" placeholder="Name (optional)" />' : ''}
            <input type="email" id="auth-email" placeholder="Email" required />
            <input type="password" id="auth-password" placeholder="Password" required minlength="8" />
            <button type="submit" id="auth-submit">${isRegister ? 'Create Account' : 'Sign In'}</button>
          </form>
          <div class="login-divider"><span>or</span></div>
          <a href="${getGoogleAuthUrl()}" class="google-btn">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </a>
          <p class="login-toggle">
            ${isRegister ? 'Already have an account?' : "Don't have an account?"}
            <a href="#" id="toggle-mode">${isRegister ? 'Sign in' : 'Create one'}</a>
          </p>
        </div>
      </div>
    `;

    // Check URL params for messages
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    if (params.get('verified') === 'true') {
      showSuccess('Email verified! You can now sign in.');
    }

    document.getElementById('toggle-mode')!.addEventListener('click', (e) => {
      e.preventDefault();
      isRegister = !isRegister;
      render();
    });

    document.getElementById('auth-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('auth-email') as HTMLInputElement).value;
      const password = (document.getElementById('auth-password') as HTMLInputElement).value;
      const nameEl = document.getElementById('auth-name') as HTMLInputElement | null;
      const submitBtn = document.getElementById('auth-submit') as HTMLButtonElement;

      hideError();
      hideSuccess();
      submitBtn.disabled = true;
      submitBtn.textContent = isRegister ? 'Creating...' : 'Signing in...';

      try {
        if (isRegister) {
          const result = await register(email, password, nameEl?.value);
          if (result.error) {
            showError(result.error);
          } else {
            showSuccess(result.message || 'Check your email to verify your account.');
            isRegister = false;
          }
        } else {
          const result = await login(email, password);
          if (result.error) {
            showError(result.error);
          } else {
            onLogin();
            navigate('/library');
          }
        }
      } catch {
        showError('Something went wrong. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'Create Account' : 'Sign In';
      }
    });
  }

  function showError(msg: string) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function hideError() {
    const el = document.getElementById('login-error');
    if (el) el.style.display = 'none';
  }

  function showSuccess(msg: string) {
    const el = document.getElementById('login-success');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function hideSuccess() {
    const el = document.getElementById('login-success');
    if (el) el.style.display = 'none';
  }

  render();
}
