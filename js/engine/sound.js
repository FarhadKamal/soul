const cache = {};

// Tracks how many non-tick sounds are currently playing, so the ticking
// clock can pause whenever a real game sound is active and resume (from the
// beginning) once things go quiet again - keeps the tick from ever mixing
// with other audio.
let busyCount = 0;
let tickAudio = null;      // the currently-playing tick Audio element, if any
let tickShouldPlay = false; // whether a timer wants the tick loop active right now

function get(name) {
  if (!cache[name]) {
    cache[name] = new Audio(`assets/sounds/${name}.mp3`);
  }
  return cache[name];
}

// Background music: a single independent looping track, entirely separate
// from the busyCount/tick machinery above - it just keeps playing quietly
// under every sound effect for the whole match, never paused/resumed by them.
// Only one music track (menu or battle) plays at a time.
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

function startTickAudio() {
  if (tickAudio) return; // already playing
  try {
    const node = get('tick').cloneNode();
    node.loop = true;
    node.volume = 0.45;
    node.play().catch(() => {});
    tickAudio = node;
  } catch {
    // ignore
  }
}

function stopTickAudio() {
  if (tickAudio) {
    tickAudio.pause();
    tickAudio = null;
  }
}

function markBusyUntilDone(node) {
  busyCount++;
  stopTickAudio(); // pause the ticking clock while this sound plays
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    busyCount = Math.max(0, busyCount - 1);
    if (busyCount === 0 && tickShouldPlay) {
      startTickAudio(); // resume ticking, restarting from the beginning
    }
  };
  node.addEventListener('ended', release, { once: true });
  node.addEventListener('pause', release, { once: true });
  node.addEventListener('error', release, { once: true });
  return release;
}

export function playSound(name) {
  try {
    const base = get(name);
    // Clone so overlapping triggers (rapid clicks) don't cut each other off.
    const node = base.cloneNode();
    node.volume = 0.6;
    const release = markBusyUntilDone(node);
    node.play().catch(release);
  } catch {
    // Ignore playback failures (e.g. autoplay policy before first user gesture).
  }
}

// Starts the continuous ticking-clock loop (used while a turn/target timer
// is counting down). Safe to call repeatedly - a no-op if already playing.
export function startTickLoop() {
  tickShouldPlay = true;
  if (busyCount === 0) startTickAudio();
}

// Stops the ticking-clock loop entirely (timer cleared/expired/cancelled).
export function stopTickLoop() {
  tickShouldPlay = false;
  stopTickAudio();
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
