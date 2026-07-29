import { CHARACTERS, CHARACTER_IDS } from '../data/characters.js';
import { playUiClick } from '../engine/sound.js';
import { renderRulesModal } from './rulesScreen.js';
import { toggleFullscreen } from './fullscreen.js';

export function renderSetupScreen(container, onStart) {
  let mode = null;
  let playerCount = 0;
  let picksPerPlayer = 0;
  const picks = []; // array of arrays of characterId, index = player index
  const isPC = []; // array of booleans, index = player index - human by default

  function render() {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'setup-screen';

    const h1 = document.createElement('h1');
    h1.textContent = 'SOUL CLASH';
    wrap.appendChild(h1);

    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = 'Choose your mode and characters';
    wrap.appendChild(subtitle);

    const topButtons = document.createElement('div');
    topButtons.className = 'setup-top-buttons';

    const rulesBtn = document.createElement('button');
    rulesBtn.className = 'btn how-to-play-btn';
    rulesBtn.textContent = 'How to Play';
    rulesBtn.onclick = () => {
      playUiClick();
      renderRulesModal(document.body);
    };
    topButtons.appendChild(rulesBtn);

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'btn';
    fullscreenBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    fullscreenBtn.onclick = () => {
      playUiClick();
      toggleFullscreen();
    };
    topButtons.appendChild(fullscreenBtn);

    wrap.appendChild(topButtons);

    const modeSelect = document.createElement('div');
    modeSelect.className = 'mode-select';
    [
      { key: '1v1', label: '1 vs 1', desc: 'Each player picks 1 character', players: 2, picks: 1 },
      { key: '2p', label: '2 Players', desc: 'Each player picks 2 characters', players: 2, picks: 2 },
      { key: '4p', label: '4 Players', desc: 'Each player picks 1 character', players: 4, picks: 1 },
    ].forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn' + (mode === opt.key ? ' selected' : '');
      btn.innerHTML = `<strong>${opt.label}</strong><span>${opt.desc}</span>`;
      btn.onclick = () => {
        playUiClick();
        mode = opt.key;
        playerCount = opt.players;
        picksPerPlayer = opt.picks;
        picks.length = 0;
        isPC.length = 0;
        for (let i = 0; i < playerCount; i++) {
          picks.push([]);
          isPC.push(false);
        }
        render();
      };
      modeSelect.appendChild(btn);
    });
    wrap.appendChild(modeSelect);

    if (mode) {
      const panels = document.createElement('div');
      panels.className = 'player-panels';

      const allPicked = new Set(picks.flat());

      for (let pIndex = 0; pIndex < playerCount; pIndex++) {
        const panel = document.createElement('div');
        panel.className = 'player-panel';

        const headerRow = document.createElement('div');
        headerRow.className = 'player-panel-header';

        const h3 = document.createElement('h3');
        h3.textContent = `Player ${pIndex + 1}`;
        headerRow.appendChild(h3);

        const pcToggle = document.createElement('button');
        pcToggle.type = 'button';
        pcToggle.className = 'pc-toggle' + (isPC[pIndex] ? ' active' : '');
        pcToggle.textContent = isPC[pIndex] ? '🖥 PC' : '🧑 Human';
        pcToggle.onclick = () => {
          playUiClick();
          isPC[pIndex] = !isPC[pIndex];
          render();
        };
        headerRow.appendChild(pcToggle);

        panel.appendChild(headerRow);

        const status = document.createElement('div');
        status.className = 'pick-status';
        status.textContent = `${picks[pIndex].length} / ${picksPerPlayer} chosen`;
        panel.appendChild(status);

        const grid = document.createElement('div');
        grid.className = 'character-grid';

        CHARACTER_IDS.forEach((id) => {
          const def = CHARACTERS[id];
          const tile = document.createElement('button');
          const isPickedByThis = picks[pIndex].includes(id);
          const isPickedByOther = allPicked.has(id) && !isPickedByThis;
          const isFull = picks[pIndex].length >= picksPerPlayer && !isPickedByThis;
          tile.className = 'character-tile' + (isPickedByThis ? ' picked' : '');
          tile.disabled = isPickedByOther || isFull;
          tile.innerHTML = `<img class="tile-portrait" src="assets/portraits/${id}.png" alt="${def.name}" /><strong>${def.name}</strong>${def.role}`;
          tile.onclick = () => {
            playUiClick();
            if (isPickedByThis) {
              picks[pIndex] = picks[pIndex].filter((c) => c !== id);
            } else {
              picks[pIndex].push(id);
            }
            render();
          };
          grid.appendChild(tile);
        });

        panel.appendChild(grid);
        panels.appendChild(panel);
      }

      wrap.appendChild(panels);

      const footer = document.createElement('div');
      footer.className = 'setup-footer';
      const startBtn = document.createElement('button');
      startBtn.className = 'btn btn-primary';
      startBtn.textContent = 'Start Match';
      const allValid = picks.every((p) => p.length === picksPerPlayer);
      startBtn.disabled = !allValid;
      startBtn.onclick = () => {
        playUiClick();
        const playerPicks = picks.map((characterIds, i) => ({
          id: `player-${i + 1}`,
          name: `Player ${i + 1}`,
          characterIds,
          isPC: isPC[i],
        }));
        onStart(mode, playerPicks);
      };
      footer.appendChild(startBtn);
      wrap.appendChild(footer);
    }

    container.appendChild(wrap);
  }

  document.addEventListener('fullscreenchange', render);

  render();
}
