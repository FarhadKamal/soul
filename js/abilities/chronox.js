import { applyDamage } from '../engine/damagePipeline.js';
import { flipCoin } from '../engine/random.js';

export function onTurnStart(character, game, log) {
  // Chrono Guard: shield RESETS to exactly 1 each turn - does not stack.
  character.shield = 1;
  log.push({ type: 'passive', characterId: character.id, text: `${character.id}'s shield resets to 1 (Chrono Guard)` });

  // Freeze continuation: from the turn AFTER Time Freeze first lands, every
  // Chronox turn rolls an automatic bonus flip regardless of who he attacks.
  if (character.special.freezeActive) {
    const flip = flipCoin();
    const frozenId = character.special.freezeTargetId;
    if (flip === 'heads') {
      const frozen = game.characters[frozenId];
      if (frozen && !frozen.isKO) frozen.skipNextTurn = true;
      log.push({ type: 'freeze-continue', targetCharacterId: frozenId, flip });
    } else {
      character.special.freezeActive = false;
      character.special.freezeTargetId = null;
      log.push({ type: 'freeze-end', targetCharacterId: frozenId, flip });
    }
  }
}

export const actions = {
  cyclonePunch: {
    label: 'Cyclone Punch',
    needsTarget: true,
    isLegal: () => true,
    execute(character, targetId, game, log) {
      const flip = flipCoin();
      const amount = flip === 'heads' ? 2 : 1;
      const result = applyDamage(game, log, {
        sourceCharacterId: character.id,
        targetCharacterId: targetId,
        amount,
      });
      log.push({ type: 'attack', characterId: character.id, actionId: 'cyclonePunch', targetId, flip, ...result });
      return result;
    },
  },
  timeFreeze: {
    label: 'Time Freeze',
    needsTarget: true,
    isLegal: (character) => !character.usedSpecial,
    execute(character, targetId, game, log) {
      character.usedSpecial = true;
      character.special.freezeActive = true;
      character.special.freezeTargetId = targetId;
      const target = game.characters[targetId];
      if (target) target.skipNextTurn = true;
      log.push({ type: 'special', characterId: character.id, actionId: 'timeFreeze', targetId });
      return { targetCharacterId: targetId };
    },
  },
};
