export function showModal({ title, body, actions }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';

  const h2 = document.createElement('h2');
  h2.textContent = title;
  modal.appendChild(h2);

  if (body) {
    const p = document.createElement('div');
    if (typeof body === 'string') {
      p.innerHTML = `<p>${body}</p>`;
    } else {
      p.appendChild(body);
    }
    modal.appendChild(p);
  }

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';
  actions.forEach(({ label, primary, onClick }) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (primary ? ' btn-primary' : '');
    btn.textContent = label;
    btn.onclick = () => {
      overlay.remove();
      onClick?.();
    };
    actionsRow.appendChild(btn);
  });
  modal.appendChild(actionsRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return overlay;
}
