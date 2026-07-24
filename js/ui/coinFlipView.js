import { showModal } from './modal.js';

export function showCoinFlipResult(flip, { title = 'Coin Flip' } = {}) {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.innerHTML = `<div class="coin-result">${flip === 'heads' ? '🟡 HEADS' : '⚪ TAILS'}</div>`;
    showModal({
      title,
      body,
      actions: [{ label: 'Continue', primary: true, onClick: resolve }],
    });
  });
}

// Players physically play Rock-Paper-Scissors at the table; the moderator
// taps whichever outcome actually happened rather than the app rolling it.
export function askRPSOutcome({ attackerName = 'Attacker' } = {}) {
  return new Promise((resolve) => {
    showModal({
      title: 'Chaos Gamble',
      body: `Players: play Rock-Paper-Scissors now.<br>Moderator, tap the result.`,
      actions: [
        { label: `${attackerName} Wins (-3❤)`, primary: true, onClick: () => resolve('win') },
        { label: 'Draw (-1❤)', onClick: () => resolve('draw') },
        { label: `${attackerName} Loses (Miss)`, onClick: () => resolve('lose') },
      ],
    });
  });
}
