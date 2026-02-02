import { getScores, deleteScore, getPublicScores, publishScore, unpublishScore, type ScoreSummary } from '../api';
import { navigate } from '../router';

interface PublicScoreSummary extends ScoreSummary {
  user_name?: string;
}

export async function renderLibraryPage(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="library-page"><p class="loading">Loading your scores...</p></div>';

  try {
    const [scores, publicScores] = await Promise.all([getScores(), getPublicScores()]);
    renderPage(container, scores, publicScores as PublicScoreSummary[]);
  } catch {
    container.innerHTML = '<div class="library-page"><p class="error">Failed to load scores.</p></div>';
  }
}

function scoreCard(s: ScoreSummary | PublicScoreSummary, actions: string): string {
  const userName = 'user_name' in s && s.user_name ? `<p class="score-author">by ${escapeHtml(s.user_name as string)}</p>` : '';
  return `
    <div class="score-card" data-id="${s.id}">
      <div class="score-card-thumb">
        ${s.album_image
          ? `<img src="${s.album_image}" alt="" class="score-card-image" />`
          : `<div class="score-card-image-placeholder"><span>&#9835;</span></div>`
        }
      </div>
      <div class="score-card-body">
        <h3>${escapeHtml(s.title)}</h3>
        ${userName}
        <p class="score-date">${new Date(s.created_at).toLocaleDateString()}</p>
      </div>
      <div class="score-card-actions">
        ${actions}
      </div>
    </div>
  `;
}

function renderPage(container: HTMLElement, myScores: ScoreSummary[], publicScores: PublicScoreSummary[]) {
  const myScoreIds = new Set(myScores.map(s => s.id));

  const html = `
    <div class="library-page">
      <div class="library-header">
        <h2>My Scores</h2>
        <button id="add-score-btn" class="btn-primary">Add Score</button>
      </div>
      ${myScores.length === 0
        ? '<p class="empty-state">No scores yet. Add your first MusicXML score!</p>'
        : `<div class="score-grid">
            ${myScores.map((s) => scoreCard(s, `
              <button class="btn-view" data-id="${s.id}">Open</button>
              <button class="btn-publish" data-id="${s.id}">${publicScores.some(p => p.id === s.id) ? 'Unpublish' : 'Publish'}</button>
              <button class="btn-delete" data-id="${s.id}">Delete</button>
            `)).join('')}
          </div>`
      }

      <div class="library-header library-section">
        <h2>Common Library</h2>
      </div>
      ${publicScores.length === 0
        ? '<p class="empty-state">No public scores yet.</p>'
        : `<div class="score-grid">
            ${publicScores.filter(s => !myScoreIds.has(s.id)).map((s) => scoreCard(s, `
              <button class="btn-view-public" data-id="${s.id}">Open</button>
            `)).join('')}
          </div>`
      }
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('add-score-btn')!.addEventListener('click', () => {
    navigate('/new');
  });

  container.querySelectorAll('.btn-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(`/viewer/${btn.getAttribute('data-id')}`);
    });
  });

  container.querySelectorAll('.btn-view-public').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(`/viewer/${btn.getAttribute('data-id')}`);
    });
  });

  container.querySelectorAll('.btn-publish').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id')!;
      const isPublished = btn.textContent?.trim() === 'Unpublish';
      if (isPublished) {
        await unpublishScore(id);
      } else {
        await publishScore(id);
      }
      const [scores, pub] = await Promise.all([getScores(), getPublicScores()]);
      renderPage(container, scores, pub as PublicScoreSummary[]);
    });
  });

  container.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id')!;
      if (confirm('Delete this score?')) {
        await deleteScore(id);
        const [scores, pub] = await Promise.all([getScores(), getPublicScores()]);
        renderPage(container, scores, pub as PublicScoreSummary[]);
      }
    });
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
