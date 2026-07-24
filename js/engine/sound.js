const cache = {};

function get(name) {
  if (!cache[name]) {
    cache[name] = new Audio(`assets/sounds/${name}.mp3`);
  }
  return cache[name];
}

export function playSound(name) {
  try {
    const base = get(name);
    // Clone so overlapping triggers (rapid clicks) don't cut each other off.
    const node = base.cloneNode();
    node.volume = 0.6;
    node.play().catch(() => {});
  } catch {
    // Ignore playback failures (e.g. autoplay policy before first user gesture).
  }
}

// actionId -> sound name, per character ability.
const ACTION_SOUND = {
  cyclonePunch: 'cyclonepunch',
  timeFreeze: 'freeze',
  smash: 'smash',
  titanToss: 'toss',
  titanSmash: 'smash',
  glorySmash: 'smash',
  chargeUp: 'charge',
  thunderWrath: 'thunder',
  soulSwap: 'soulswap',
  soulSwapWrath: 'thunder',
  hiddenMark: 'hiddenmark',
  fatalSlash: 'sword',
  shadowExecution: 'shadowexecution',
  lunarStrike: 'sword',
  moonstep: 'moonstep',
  lunarEclipse: 'eclipse',
  chaosGamble: 'punch',
  jesterBall: 'jesterball',
  bloodHunt: 'sword',
  curseStrike: 'curse',
  divineRestore: 'divinerestore',
};

export function playActionSound(actionId) {
  const name = ACTION_SOUND[actionId];
  if (name) playSound(name);
}

export function playUiClick() {
  playSound('click');
}

export function playKO() {
  playSound('game-over');
}

export function playVictory() {
  playSound('victory');
}

export function playSpecial() {
  playSound('success');
}

export function playCoin() {
  playSound('coin');
}
