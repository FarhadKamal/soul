import { showModal } from './modal.js';
import { startTickLoop, stopTickLoop } from '../engine/sound.js';

const RPS_SYMBOL = { rock: '✊', paper: '✋', scissors: '✌️' };
const RPS_LABEL = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const RPS_TIMER_SECONDS = 20;

// The system has already secretly picked its move (kept hidden from
// everyone). Moderator asks the defending player "rock, paper, or
// scissors?" out loud and taps whichever they say - same pattern as
// entering a Hidden Mark target on someone's behalf. If nobody answers in
// time, a random choice is auto-picked, same as the action/target timers.
export function askDefenderRPSChoice({ defenderName = 'Target' } = {}) {
  return new Promise((resolve) => {
    let remaining = RPS_TIMER_SECONDS;
    let settled = false;

    const body = document.createElement('div');
    body.innerHTML = `
      <p>Ask <strong>${defenderName}</strong>: Rock, Paper, or Scissors?<br>Moderator, tap their answer.</p>
      <div class="action-timer">Auto-pick in <span id="rps-timer-count">${remaining}</span>s</div>
    `;

    const finish = (choice) => {
      if (settled) return;
      settled = true;
      clearInterval(intervalId);
      stopTickLoop();
      overlay.remove();
      resolve(choice);
    };

    const overlay = showModal({
      title: 'Chaos Gamble',
      body,
      actions: [
        { label: '✊ Rock', onClick: () => finish('rock') },
        { label: '✋ Paper', onClick: () => finish('paper') },
        { label: '✌️ Scissors', onClick: () => finish('scissors') },
      ],
    });

    startTickLoop();
    const intervalId = setInterval(() => {
      remaining -= 1;
      const el = document.getElementById('rps-timer-count');
      if (el) el.textContent = String(remaining);
      if (remaining <= 0) {
        const choices = ['rock', 'paper', 'scissors'];
        finish(choices[Math.floor(Math.random() * 3)]);
      }
    }, 1000);
  });
}

const RPS_REVEAL_AUTO_CONTINUE_SECONDS = 5;

// Reveals both the system's hidden pick and the defender's choice, plus the
// resulting outcome, once both are known. This is just an acknowledgment
// step (nothing to decide), so it auto-continues after a few seconds if
// nobody clicks - no need to make players wait on a click here.
export function showRPSReveal(systemChoice, defenderChoice, outcome, { attackerName = 'Boingo', defenderName = 'Target' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const outcomeText = {
      win: `${attackerName} wins! -3❤`,
      draw: 'Draw! -1❤',
      lose: `${attackerName} loses (Miss)`,
    }[outcome];
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="coin-result">${RPS_SYMBOL[systemChoice]} vs ${RPS_SYMBOL[defenderChoice]}</div>
      <p>${attackerName}: ${RPS_LABEL[systemChoice]} &nbsp;|&nbsp; ${defenderName}: ${RPS_LABEL[defenderChoice]}</p>
      <p><strong>${outcomeText}</strong></p>
      <div class="action-timer">Continuing in <span id="rps-reveal-count">${RPS_REVEAL_AUTO_CONTINUE_SECONDS}</span>s</div>
    `;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(intervalId);
      overlay.remove();
      resolve();
    };

    const overlay = showModal({
      title: 'Chaos Gamble Result',
      body,
      actions: [{ label: 'Continue', primary: true, onClick: finish }],
    });

    let remaining = RPS_REVEAL_AUTO_CONTINUE_SECONDS;
    const intervalId = setInterval(() => {
      remaining -= 1;
      const el = document.getElementById('rps-reveal-count');
      if (el) el.textContent = String(remaining);
      if (remaining <= 0) finish();
    }, 1000);
  });
}
