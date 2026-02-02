import { getCurrentUser, logout, type User } from './api';
import { addRoute, startRouter, navigate } from './router';
import { renderLoginPage } from './pages/login';
import { renderLibraryPage } from './pages/library';
import { renderViewerPage, renderNewScorePage } from './pages/viewer';
import './style.css';

const app = document.getElementById('app')!;
let currentUser: User | null = null;

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
  renderHeader();
}

function getThemeIcon(): string {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight ? '\u2600\uFE0F' : '\uD83C\uDF19';
}

function renderHeader() {
  let header = document.getElementById('app-header');
  if (!header) {
    header = document.createElement('header');
    header.id = 'app-header';
    app.prepend(header);
  }

  if (currentUser) {
    header.innerHTML = `
      <div class="header-inner">
        <a href="#/library" class="header-brand"><img src="/logo.svg" alt="" class="header-logo" />Riff Music</a>
        <div class="header-user">
          <span class="header-email">${currentUser.email}</span>
          <button class="theme-toggle" id="theme-toggle">${getThemeIcon()}</button>
          <button id="logout-btn">Logout</button>
        </div>
      </div>
    `;
    document.getElementById('logout-btn')!.addEventListener('click', async () => {
      await logout();
      currentUser = null;
      renderHeader();
      navigate('/login');
    });
    document.getElementById('theme-toggle')!.addEventListener('click', toggleTheme);
  } else {
    header.innerHTML = `
      <div class="header-inner">
        <span class="header-brand"><img src="/logo.svg" alt="" class="header-logo" />Riff Music</span>
        <button class="theme-toggle" id="theme-toggle">${getThemeIcon()}</button>
      </div>
    `;
    document.getElementById('theme-toggle')!.addEventListener('click', toggleTheme);
  }
}

function getContentContainer(): HTMLElement {
  let content = document.getElementById('app-content');
  if (!content) {
    content = document.createElement('div');
    content.id = 'app-content';
    app.appendChild(content);
  }
  return content;
}

function requireAuth(handler: (params: Record<string, string>) => void | Promise<void>) {
  return (params: Record<string, string>) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    handler(params);
  };
}

addRoute('/login', () => {
  renderHeader();
  renderLoginPage(getContentContainer(), () => {
    init();
  });
});

addRoute('/library', requireAuth(() => {
  renderHeader();
  renderLibraryPage(getContentContainer());
}));

addRoute('/viewer/:id', requireAuth((params) => {
  renderHeader();
  renderViewerPage(getContentContainer(), params.id);
}));

addRoute('/new', requireAuth(() => {
  renderHeader();
  renderNewScorePage(getContentContainer());
}));

async function init() {
  initTheme();
  currentUser = await getCurrentUser();
  renderHeader();
  startRouter();

  if (!currentUser) {
    navigate('/login');
  }
}

init();
