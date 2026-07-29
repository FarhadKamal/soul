const cache = {};

function get(name) {
  if (!cache[name]) {
    cache[name] = new Audio(`assets/sounds/${name}.mp3`);
  }
  return cache[name];
}

// Background music: a single independent looping track that just keeps
// playing quietly under every sound effect for the whole match. Only one
// music track (menu or battle) plays at a time.
let musicAudio = null;
let musicTrack = null; // 'menu' | 'battle' | null

function startMusic(track, file, volume) {
  if (musicTrack === track) return; // already playing this track
  if (musicAudio) musicAudio.pause();
  try {
    const node = new Audio(`assets/sounds/${file}`);
    node.loop = true;
    node.volume = volume;
    node.play().catch(() => {});
    musicAudio = node;
    musicTrack = track;
  } catch {
    // ignore
  }
}

export function startMenuMusic() {
  startMusic('menu', 'bgm-menu.mp3', 0.3);
}

export function startBattleMusic() {
  startMusic('battle', 'bgm-battle.mp3', 0.25);
}

export function stopBattleMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio = null;
    musicTrack = null;
  }
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

// The ticking-clock loop is disabled - it clashed with the battle
// background music and was reported as annoying. Kept as no-ops so every
// call site (turn/target timers) doesn't need to change.
export function startTickLoop() {}

export function stopTickLoop() {}

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
