export function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

const RPS_CHOICES = ['rock', 'paper', 'scissors'];

function beats(a, b) {
  return (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  );
}

// The system (standing in for Boingo) secretly commits to a hidden RPS
// choice before the defending player reveals theirs.
export function pickSystemRPS() {
  return RPS_CHOICES[Math.floor(Math.random() * 3)];
}

// Resolves the real RPS outcome once both choices are known. Outcome is
// from the system/Boingo's perspective: 'win' means Boingo's throw beats
// the defender's, 'lose' means the defender's beats Boingo's.
export function resolveRPS(systemChoice, defenderChoice) {
  if (systemChoice === defenderChoice) return 'draw';
  return beats(systemChoice, defenderChoice) ? 'win' : 'lose';
}
