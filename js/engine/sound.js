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

// Battle/menu track pools - one is picked at random each time the match
// (or the setup screen) starts, so repeated visits don't always hear the
// same loop. Drop more mp3 files into assets/sounds/ and add their names
// here to grow either pool.
const BATTLE_TRACKS = ['bgm-battle.mp3', 'bgm-battle-2.mp3', 'bgm-battle-3.mp3'];
const MENU_TRACKS = ['bgm-menu.mp3', 'bgm-menu-2.mp3', 'bgm-menu-3.mp3'];

// Browsers block audio autoplay until the user has interacted with the
// page at least once - the very first call to startMenuMusic() happens on
// initial page load (main.js), before any click/tap, so play() silently
// rejects and no music is heard even though everything else works fine.
// This listens for the first user interaction anywhere on the page and
// retries playing whatever music track is current at that point, so music
// picks up the instant the browser actually allows it.
let pendingAutoplayRetry = false;
function armAutoplayRetry() {
  if (pendingAutoplayRetry) return;
  pendingAutoplayRetry = true;
  const retry = () => {
    document.removeEventListener('pointerdown', retry);
    document.removeEventListener('keydown', retry);
    pendingAutoplayRetry = false;
    if (musicAudio) musicAudio.play().catch(() => armAutoplayRetry());
  };
  document.addEventListener('pointerdown', retry, { once: true });
  document.addEventListener('keydown', retry, { once: true });
}

function startMusic(track, file, volume) {
  if (musicTrack === track) return; // already playing this track
  if (musicAudio) musicAudio.pause();
  try {
    const node = new Audio(`assets/sounds/${file}`);
    node.loop = true;
    node.volume = volume;
    node.play().catch(() => armAutoplayRetry());
    musicAudio = node;
    musicTrack = track;
  } catch {
    // ignore
  }
}

export function startMenuMusic() {
  // Same "force a fresh pick" reasoning as startBattleMusic() - otherwise
  // returning to the menu (e.g. after New Match) would silently keep
  // whichever menu track was already playing instead of re-rolling.
  musicTrack = null;
  const file = MENU_TRACKS[Math.floor(Math.random() * MENU_TRACKS.length)];
  startMusic('menu', file, 0.3);
}

export function startBattleMusic() {
  // Force a fresh random pick every match start, even if a battle track is
  // already playing (e.g. New Match without returning to the menu screen
  // first) - otherwise musicTrack === 'battle' would short-circuit and
  // silently keep the previous match's track going.
  musicTrack = null;
  const file = BATTLE_TRACKS[Math.floor(Math.random() * BATTLE_TRACKS.length)];
  startMusic('battle', file, 0.25);
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
