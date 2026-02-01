import { getScores, deleteScore, type ScoreSummary } from '../api';
import { navigate } from '../router';

export async function renderLibraryPage(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="library-page"><p class="loading">Loading your scores...</p></div>';

  try {
    const scores = await getScores();
    renderGrid(container, scores);
  } catch {
    container.innerHTML = '<div class="library-page"><p class="error">Failed to load scores.</p></div>';
  }
}

function renderGrid(container: HTMLElement, scores: ScoreSummary[]) {
  const html = `
    <div class="library-page">
      <div class="library-header">
        <h2>My Scores</h2>
        <button id="add-score-btn" class="btn-primary">Add Score</button>
      </div>
      ${scores.length === 0
        ? '<p class="empty-state">No scores yet. Add your first MusicXML score!</p>'
        : `<div class="score-grid">
            ${scores.map((s) => `
              <div class="score-card" data-id="${s.id}">
                <div class="score-card-body">
                  <h3>${escapeHtml(s.title)}</h3>
                  <p class="score-date">${new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <div class="score-card-actions">
                  <button class="btn-view" data-id="${s.id}">Open</button>
                  <button class="btn-delete" data-id="${s.id}">Delete</button>
                </div>
              </div>
            `).join('')}
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

  container.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id')!;
      if (confirm('Delete this score?')) {
        await deleteScore(id);
        const updated = await getScores();
        renderGrid(container, updated);
      }
    });
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
