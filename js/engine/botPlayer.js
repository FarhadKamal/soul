import { getUsableActions, isValidTarget } from './turnEngine.js';

// Pure decision logic for PC-controlled characters - no DOM, no side
// effects. Given a character whose turn it is, returns the action+target
// the bot wants to use. The caller (dashboardScreen.js) feeds this straight
// into the same onActionChosen() path a human click would use, so bots and
// humans always resolve identically once a choice is made.

function livingEnemies(game, character) {
  return Object.values(game.characters).filter(
    (c) => c.ownerId !== character.ownerId && !c.isKO && !c.untargetable
  );
}

function validTargetsFor(game, character, actionId) {
  return Object.keys(game.characters).filter((tid) => isValidTarget(game, character.id, actionId, tid));
}

// Prefers whichever legal target has the fewest hearts left (closest to a
// kill) - a simple but effective default "focus the weakest enemy" rule
// used as a fallback whenever a character has no more specific priority.
function lowestHeartsTarget(game, targetIds) {
  if (targetIds.length === 0) return null;
  return targetIds.reduce((best, tid) => {
    const t = game.characters[tid];
    const b = game.characters[best];
    return t.hearts < b.hearts ? tid : best;
  });
}

// How much recent damage each living enemy has dealt to this character,
// read from the match log - used to identify "who's been attacking me
// most" for defensive/retaliation decisions. Looks at the last 30 log
// entries, which comfortably covers a couple of full rounds.
function threatByAttacker(game, character) {
  const tally = {};
  const recent = game.log.slice(-30);
  for (const entry of recent) {
    if (entry.targetCharacterId !== character.id && entry.targetId !== character.id) continue;
    const attackerId = entry.characterId || entry.sourceCharacterId;
    if (!attackerId || attackerId === character.id) continue;
    const dmg = entry.amountDealt || 0;
    if (dmg > 0) tally[attackerId] = (tally[attackerId] || 0) + dmg;
  }
  return tally;
}

function biggestThreatTarget(game, character, targetIds) {
  if (targetIds.length === 0) return null;
  const tally = threatByAttacker(game, character);
  let best = null;
  let bestScore = -1;
  for (const tid of targetIds) {
    const score = tally[tid] || 0;
    if (score > bestScore) {
      bestScore = score;
      best = tid;
    }
  }
  return bestScore > 0 ? best : null;
}

// True if this character is currently the cursed target of a live Athena -
// used to steer bots away from attacking Athena while cursed, since that
// damage mirrors straight back onto them.
function isCursedByLiveAthena(game, character) {
  const athena = Object.values(game.characters).find(
    (c) => c.id === 'athena' && !c.isKO && c.special.curseTargetCharacterId === character.id
  );
  return !!athena;
}

const LOW_HEARTS_THRESHOLD = 3;

function pickDefaultTarget(game, character, actionId) {
  const targets = validTargetsFor(game, character, actionId);
  if (targets.length === 0) return null;
  // Avoid hitting Athena while self-cursed unless she's the only option or
  // it would finish her off (worth eating the mirror for a kill).
  const nonAthenaSafe = targets.filter((tid) => {
    const t = game.characters[tid];
    if (t.id !== 'athena' || !isCursedByLiveAthena(game, character)) return true;
    return false;
  });
  const pool = nonAthenaSafe.length > 0 ? nonAthenaSafe : targets;
  return biggestThreatTarget(game, character, pool) || lowestHeartsTarget(game, pool);
}

// ---- Per-character move selection ----
// Each function returns { actionId, targetId } or null if it has nothing
// usable (shouldn't normally happen - getUsableActions always offers
// something when the character can act at all).

function chooseTharoxMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  // Mandatory cash-in already narrows usable to just Titan Smash/Glory
  // Smash while charged - prefer Glory Smash (heal+shield bonus) whenever
  // it's available, otherwise Titan Smash. Uncharged: Toss to build a
  // charge unless already at low hearts and an immediate hit is safer.
  if (byId.glorySmash) {
    return { actionId: 'glorySmash', targetId: pickDefaultTarget(game, character, 'glorySmash') };
  }
  if (byId.titanSmash) {
    return { actionId: 'titanSmash', targetId: pickDefaultTarget(game, character, 'titanSmash') };
  }
  if (byId.titanToss) {
    return { actionId: 'titanToss', targetId: null };
  }
  return { actionId: 'smash', targetId: pickDefaultTarget(game, character, 'smash') };
}

function chooseZerathysMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  const chargeCount = character.special.chargeCount;
  // Soul Swap is strongest when the target has meaningfully more hearts
  // than Zerathys - stealing their pool and dumping his lower total onto
  // them. Use it opportunistically once available.
  if (byId.soulSwap) {
    const targets = validTargetsFor(game, character, 'soulSwap');
    const best = targets.reduce((b, tid) => {
      const t = game.characters[tid];
      if (!b) return tid;
      return t.hearts > game.characters[b].hearts ? tid : b;
    }, null);
    if (best && game.characters[best].hearts > character.hearts + 1) {
      return { actionId: 'soulSwap', targetId: best };
    }
  }
  // At max charge, always cash in - no reason to hold at the cap.
  if (chargeCount >= 2) {
    return { actionId: 'thunderWrath', targetId: pickDefaultTarget(game, character, 'thunderWrath') };
  }
  // Low hearts: don't sit around charging, take the guaranteed hit now.
  if (character.hearts <= LOW_HEARTS_THRESHOLD) {
    return { actionId: 'thunderWrath', targetId: pickDefaultTarget(game, character, 'thunderWrath') };
  }
  if (byId.chargeUp) {
    return { actionId: 'chargeUp', targetId: null };
  }
  return { actionId: 'thunderWrath', targetId: pickDefaultTarget(game, character, 'thunderWrath') };
}

function chooseChronoxMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  // Time Freeze is best spent either defensively (Chronox himself is low
  // and needs to lock down whoever's been hurting him) or offensively on
  // the biggest live threat once available - it denies 2 of their turns.
  if (byId.timeFreeze) {
    const targets = validTargetsFor(game, character, 'timeFreeze');
    const threatId = biggestThreatTarget(game, character, targets) || lowestHeartsTarget(game, targets);
    if (threatId && (character.hearts <= LOW_HEARTS_THRESHOLD || targets.length > 0)) {
      return { actionId: 'timeFreeze', targetId: threatId };
    }
  }
  return { actionId: 'cyclonePunch', targetId: pickDefaultTarget(game, character, 'cyclonePunch') };
}

function chooseAkyrosMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  const markedTargets = validTargetsFor(game, character, 'shadowExecution');
  // Shadow Execution secures a kill/heavy hit on an already-marked, weak
  // enemy - use it once one is low enough that -3 ignoring shields matters.
  if (byId.shadowExecution) {
    const weakest = lowestHeartsTarget(game, markedTargets);
    if (weakest && game.characters[weakest].hearts <= 3) {
      return { actionId: 'shadowExecution', targetId: weakest };
    }
  }
  // Prefer Fatal Slash on an already-marked target for the bonus damage.
  const fatalTargets = validTargetsFor(game, character, 'fatalSlash');
  const markedFatalTarget = fatalTargets.find((tid) => character.special.marks.has(tid));
  if (markedFatalTarget) {
    return { actionId: 'fatalSlash', targetId: markedFatalTarget };
  }
  // Otherwise, place a Hidden Mark on an unmarked enemy when one's
  // available (sets up future bonus damage / Shadow Execution), else just
  // Fatal Slash the biggest threat.
  if (byId.hiddenMark) {
    const markTargets = validTargetsFor(game, character, 'hiddenMark');
    const targetId = biggestThreatTarget(game, character, markTargets) || lowestHeartsTarget(game, markTargets);
    if (targetId) return { actionId: 'hiddenMark', targetId };
  }
  return { actionId: 'fatalSlash', targetId: pickDefaultTarget(game, character, 'fatalSlash') };
}

function chooseVeloryaMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  // Eclipse is a defensive panic button - use it when low on hearts to buy
  // 3 safe attacks, rather than burning it early/randomly.
  if (byId.lunarEclipse && character.hearts <= LOW_HEARTS_THRESHOLD) {
    return { actionId: 'lunarEclipse', targetId: null };
  }
  if (byId.moonstep) {
    const targets = validTargetsFor(game, character, 'moonstep');
    // Moonstep's -2 bonus requires a DIFFERENT target than her last attack -
    // prefer whichever valid target isn't lastTargetId to get the bonus.
    const differentTarget = targets.find((tid) => tid !== character.special.lastTargetId);
    const targetId = differentTarget || biggestThreatTarget(game, character, targets) || lowestHeartsTarget(game, targets);
    if (targetId) return { actionId: 'moonstep', targetId };
  }
  return { actionId: 'lunarStrike', targetId: pickDefaultTarget(game, character, 'lunarStrike') };
}

function chooseBladeMove(character, game, usable) {
  // Only one real action - the decision is entirely about target. Staying
  // on the same streak target keeps compounding damage; only switch if
  // that target is no longer valid or a clean kill is available elsewhere.
  const targets = validTargetsFor(game, character, 'bloodHunt');
  if (targets.length === 0) return { actionId: 'bloodHunt', targetId: null };
  const streakTarget = character.special.streakTargetId;
  if (streakTarget && targets.includes(streakTarget)) {
    return { actionId: 'bloodHunt', targetId: streakTarget };
  }
  const targetId = biggestThreatTarget(game, character, targets) || lowestHeartsTarget(game, targets);
  return { actionId: 'bloodHunt', targetId: targetId || targets[0] };
}

function chooseAthenaMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  if (byId.divineRestore && character.hearts <= LOW_HEARTS_THRESHOLD) {
    return { actionId: 'divineRestore', targetId: null };
  }
  // Curse whoever's the biggest threat, so their own future hits against
  // Athena mirror back onto them too.
  const targets = validTargetsFor(game, character, 'curseStrike');
  const targetId = biggestThreatTarget(game, character, targets) || lowestHeartsTarget(game, targets);
  return { actionId: 'curseStrike', targetId: targetId || targets[0] || null };
}

function chooseBoingoMove(character, game, usable) {
  const byId = Object.fromEntries(usable.map((a) => [a.actionId, a]));
  // Jester Ball is a coin-flip-shaped social weapon - throw it at the
  // biggest threat so either outcome (they eat -4, or they pass/return it
  // and burn a turn deciding) works in Boingo's favor.
  if (byId.jesterBall) {
    const targets = validTargetsFor(game, character, 'jesterBall');
    const targetId = biggestThreatTarget(game, character, targets) || lowestHeartsTarget(game, targets);
    if (targetId) return { actionId: 'jesterBall', targetId };
  }
  return { actionId: 'chaosGamble', targetId: pickDefaultTarget(game, character, 'chaosGamble') };
}

const MOVE_CHOOSERS = {
  tharox: chooseTharoxMove,
  zerathys: chooseZerathysMove,
  chronox: chooseChronoxMove,
  akyros: chooseAkyrosMove,
  velorya: chooseVeloryaMove,
  blade: chooseBladeMove,
  athena: chooseAthenaMove,
  boingo: chooseBoingoMove,
};

// Fallback for characters without bot logic yet: picks a random usable
// action and a sensible (lowest-hearts) target rather than a fully random
// target, so early testing isn't dragged down by nonsensical fallback play.
function chooseFallbackMove(character, game, usable) {
  const action = usable[Math.floor(Math.random() * usable.length)];
  if (!action.needsTarget) return { actionId: action.actionId, targetId: null };
  return { actionId: action.actionId, targetId: pickDefaultTarget(game, character, action.actionId) };
}

export function chooseBotMove(character, game) {
  const usable = getUsableActions(character, game);
  if (usable.length === 0) return null;
  const chooser = MOVE_CHOOSERS[character.id] || chooseFallbackMove;
  const move = chooser(character, game, usable);
  if (!move) return chooseFallbackMove(character, game, usable);
  // Safety net: if the chosen target somehow isn't valid (e.g. a scoring
  // helper returned null), fall back to a sensible default rather than
  // letting an invalid move through.
  if (move.targetId === null && usable.find((a) => a.actionId === move.actionId)?.needsTarget) {
    return { actionId: move.actionId, targetId: pickDefaultTarget(game, character, move.actionId) };
  }
  return move;
}

// Jester Ball resolution for a PC holder. Returns 'return_' | 'pass' | 'take'
// and, for 'pass', the chosen new holder's character id.
export function chooseBotJesterBallMove(character, game) {
  const jb = game.jesterBall;
  const boingo = game.characters[jb.thrownByCharacterId];
  // Passing it onto an enemy is the best outcome when available - it moves
  // the eventual -4 (or the whole decision) onto whoever's the biggest
  // threat instead of eating it themselves.
  if (jb.canPass) {
    const candidates = livingEnemies(game, character).filter((c) => c.id !== character.id);
    if (candidates.length > 0) {
      const targetId = biggestThreatTarget(game, character, candidates.map((c) => c.id))
        || lowestHeartsTarget(game, candidates.map((c) => c.id));
      if (targetId) return { choice: 'pass', targetId };
    }
  }
  // Return only makes sense if Boingo is a teammate (or this character IS
  // Boingo) - Return always heals him +4 regardless of who returns it, so
  // handing a free heal to an enemy Boingo would be self-defeating.
  if (boingo && boingo.ownerId === character.ownerId) {
    return { choice: 'return_' };
  }
  // Otherwise Take is the only sensible remaining option.
  return { choice: 'take' };
}
