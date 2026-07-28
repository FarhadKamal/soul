import { CHARACTERS } from '../data/characters.js';

function nameOf(id) {
  return CHARACTERS[id]?.name || id;
}

function formatEntry(entry) {
  switch (entry.type) {
    case 'attack': {
      const dmg = entry.dodged ? 0 : entry.amountDealt ?? 0;
      let text = `${nameOf(entry.characterId)} used ${labelFor(entry.actionId)} on ${nameOf(entry.targetId)}`;
      if (entry.dodged) text += ' — DODGED! (0 damage)';
      else text += ` — ${dmg} damage`;
      if (entry.absorbed) text += ` (${entry.absorbed} absorbed by shield)`;
      if (entry.koTriggered) text += ` — ${nameOf(entry.targetId)} KO'd!`;
      if (entry.wasMarked !== undefined) text += entry.wasMarked ? ' (target was MARKED)' : '';
      return text;
    }
    case 'setup':
      if (entry.actionId === 'titanToss') return `${nameOf(entry.characterId)} used Titan Toss — charge ready`;
      if (entry.actionId === 'chargeUp') return `${nameOf(entry.characterId)} charged up (${entry.chargeCount}/2)`;
      return `${nameOf(entry.characterId)} used ${labelFor(entry.actionId)}`;
    case 'special': {
      let text = `${nameOf(entry.characterId)} used their SPECIAL: ${labelFor(entry.actionId)}${entry.targetId ? ' on ' + nameOf(entry.targetId) : ''}`;
      if (entry.amountDealt !== undefined) {
        text += entry.dodged ? ' — DODGED! (0 damage)' : ` — ${entry.amountDealt} damage`;
        if (entry.absorbed) text += ` (${entry.absorbed} absorbed by shield)`;
        if (entry.koTriggered) text += ` — ${nameOf(entry.targetId)} KO'd!`;
      }
      return text;
    }
    case 'passive':
      return entry.text;
    case 'freeze-continue':
      return `Time Freeze continues on ${nameOf(entry.targetCharacterId)}`;
    case 'freeze-end':
      return `Time Freeze ends on ${nameOf(entry.targetCharacterId)}`;
    case 'eclipse-end':
      return `${nameOf(entry.characterId)}'s Lunar Eclipse ends`;
    case 'dodge':
      return `${nameOf(entry.targetCharacterId)} DODGED the first attack from ${nameOf(entry.attackerId)}!`;
    case 'rebirth':
      return `${nameOf(entry.targetCharacterId)} used REBIRTH — revived with 2 hearts!`;
    case 'curse-mirror':
      return `Athena's curse mirrors ${entry.amount} damage to ${nameOf(entry.toCharacterId)}`;
    case 'curse':
      return `Athena cast Curse Strike on ${nameOf(entry.targetId)}`;
    case 'hidden-mark':
      return `Akyros placed a Hidden Mark (target concealed)`;
    case 'jester-ball-return':
      return `Jester Ball returned to ${nameOf(entry.boingoId)} — +4 hearts`;
    case 'jester-ball-pass':
      return `Jester Ball passed to ${nameOf(entry.toCharacterId)}`;
    case 'jester-ball-take':
      return `${nameOf(entry.targetCharacterId)} took the Jester Ball — -4 hearts`;
    default:
      return null;
  }
}

function labelFor(actionId) {
  const map = {
    cyclonePunch: 'Cyclone Punch', timeFreeze: 'Time Freeze',
    smash: 'Smash', titanToss: 'Titan Toss', titanSmash: 'Titan Smash', glorySmash: 'Glory Smash',
    chargeUp: 'Charge Up', thunderWrath: 'Thunder Wrath', soulSwap: 'Soul Swap',
    hiddenMark: 'Hidden Mark', fatalSlash: 'Fatal Slash', shadowExecution: 'Shadow Execution',
    lunarStrike: 'Lunar Strike', moonstep: 'Moonstep', lunarEclipse: 'Lunar Eclipse',
    chaosGamble: 'Chaos Gamble', jesterBall: 'Jester Ball',
    bloodHunt: 'Blood Hunt', curseStrike: 'Curse Strike', divineRestore: 'Divine Restore',
  };
  return map[actionId] || actionId;
}

export function renderLogPanel(log) {
  const panel = document.createElement('div');
  panel.className = 'log-panel';
  const entries = log.map(formatEntry).filter(Boolean);
  if (entries.length === 0) {
    panel.innerHTML = '<div class="log-entry">Match started.</div>';
  } else {
    entries.forEach((text) => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = text;
      panel.appendChild(div);
    });
  }
  panel.scrollTop = panel.scrollHeight;
  return panel;
}
