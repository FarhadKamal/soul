import { applyDamage } from '../engine/damagePipeline.js';
import { flipCoin } from '../engine/random.js';

function maybeRollEclipseContinuation(character, log) {
  if (!character.untargetable) return;
  const flip = flipCoin();
  if (flip === 'heads') {
    log.push({ type: 'eclipse-continue', characterId: character.id, flip });
  } else {
    character.untargetable = false;
    log.push({ type: 'eclipse-end', characterId: character.id, flip });
  }
}

export const actions = {
  lunarStrike: {
    label: 'Lunar Strike',
    needsTarget: true,
    isLegal: () => true,
    execute(character, targetId, game, log) {
      character.special.hasActedOnce = true;
      character.special.lastTargetId = targetId;
      const result = applyDamage(game, log, {
        sourceCharacterId: character.id,
        targetCharacterId: targetId,
        amount: 1,
        ignoresShield: true,
      });
      log.push({ type: 'attack', characterId: character.id, actionId: 'lunarStrike', targetId, ...result });
      maybeRollEclipseContinuation(character, log);
      return result;
    },
  },
  moonstep: {
    label: 'Moonstep',
    needsTarget: true,
    isLegal: (character) => character.special.hasActedOnce,
    execute(character, targetId, game, log) {
      const isNewTarget = character.special.lastTargetId !== targetId;
      const amount = isNewTarget ? 2 : 1;
      character.special.lastTargetId = targetId;
      const result = applyDamage(game, log, {
        sourceCharacterId: character.id,
        targetCharacterId: targetId,
        amount,
        ignoresShield: true,
      });
      log.push({ type: 'attack', characterId: character.id, actionId: 'moonstep', targetId, isNewTarget, ...result });
      maybeRollEclipseContinuation(character, log);
      return result;
    },
  },
  lunarEclipse: {
    label: 'Lunar Eclipse',
    needsTarget: false,
    isLegal: (character) => !character.usedSpecial,
    execute(character, targetId, game, log) {
      character.usedSpecial = true;
      character.untargetable = true;
      character.special.hasActedOnce = true;
      log.push({ type: 'special', characterId: character.id, actionId: 'lunarEclipse' });
      return {};
    },
  },
};
