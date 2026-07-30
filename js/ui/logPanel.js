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
    case 'curse-mirror': {
      let text = `Athena's curse mirrors ${entry.amount} damage to ${nameOf(entry.toCharacterId)}`;
      if (entry.koTriggered) text += ` — ${nameOf(entry.toCharacterId)} KO'd!`;
      return text;
    }
    case 'curse':
      return `Athena cast Curse Strike on ${nameOf(entry.targetId)}`;
    case 'hidden-mark':
      return `Akyros placed a Hidden Mark (target concealed)`;
    case 'jester-ball-return': {
      const healed = entry.healed ?? 4;
      return healed > 0
        ? `Jester Ball returned to ${nameOf(entry.boingoId)} — +${healed} hearts`
        : `Jester Ball returned, but ${nameOf(entry.boingoId)} was already KO'd — no effect`;
    }
    case 'jester-ball-pass':
      return `${nameOf(entry.fromCharacterId)} passed the Jester Ball to ${nameOf(entry.toCharacterId)}`;
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

// Lines listing every player's seat number and character(s), so a copied
// log is self-contained and never requires guessing who played what from
// the events alone. 2v2 (any player with >1 character) reads as a single
// "Team 1: X, Y vs Team 2: A, B" line; 1v1/4-player list one line per seat,
// e.g. "1 Zerathys", "2 Chronox", "3 Athena", "4 Boingo".
function rosterLines(game) {
  const isTeamMode = game.players.some((p) => p.characterIds.length > 1);
  if (isTeamMode) {
    const teams = game.players.map((p, i) =>
      `Team ${i + 1}: ${p.characterIds.map(nameOf).join(', ')}`
    );
    return [teams.join(' vs ')];
  }
  return game.players.map((p, i) => `${i + 1} ${p.characterIds.map(nameOf).join(', ')}`);
}

// Plain-text lines for the full log, in order - shared by the on-screen
// panel and the "Copy Log" button so both always match exactly.
export function formatLogAsText(game) {
  const entries = game.log.map(formatEntry).filter(Boolean);
  const lines = entries.length === 0 ? ['Match started.'] : entries;
  return [...rosterLines(game), ...lines].join('\n');
}

export function renderLogPanel(game) {
  const panel = document.createElement('div');
  panel.className = 'log-panel';
  const entries = game.log.map(formatEntry).filter(Boolean);
  rosterLines(game).forEach((line) => {
    const div = document.createElement('div');
    div.className = 'log-entry log-team-line';
    div.textContent = line;
    panel.appendChild(div);
  });
  if (entries.length === 0) {
    const startedDiv = document.createElement('div');
    startedDiv.className = 'log-entry';
    startedDiv.textContent = 'Match started.';
    panel.appendChild(startedDiv);
  } else {
    entries.forEach((text) => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = text;
      panel.appendChild(div);
    });
  }
  return panel;
}
