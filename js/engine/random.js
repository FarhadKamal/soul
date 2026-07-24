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

export function playRPS() {
  const a = RPS_CHOICES[Math.floor(Math.random() * 3)];
  const b = RPS_CHOICES[Math.floor(Math.random() * 3)];
  let outcome;
  if (a === b) outcome = 'draw';
  else if (beats(a, b)) outcome = 'win';
  else outcome = 'lose';
  return { attackerChoice: a, defenderChoice: b, outcome };
}
