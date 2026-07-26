import { CHARACTERS } from '../data/characters.js';

export function renderCharacterCard(character, { isActing, isTargetable, onTargetClick, isCursed, isHit, isFrozenVisual, isRevealedMarked, isDivineLight, isRevived, ownerName, ownerColorClass }) {
  const def = CHARACTERS[character.id];
  const card = document.createElement('div');
  card.className = 'char-card';
  if (ownerColorClass) card.classList.add(ownerColorClass);
  if (isActing) card.classList.add('acting');
  if (character.isKO) card.classList.add('ko');
  if (isHit) card.classList.add('hit-flash');
  if (isFrozenVisual && !character.isKO) card.classList.add('ice-frozen');
  if (character.untargetable && !character.isKO) card.classList.add('eclipsed');
  if (isCursed && !character.isKO) card.classList.add('cursed-mark');
  if (isDivineLight && !character.isKO) card.classList.add('divine-light');
  if (isRevived && !character.isKO) card.classList.add('revive-burst');
  if (isTargetable) {
    card.classList.add('targetable');
    card.onclick = () => onTargetClick(character.id);
  }

  if (isRevealedMarked && !character.isKO) {
    const markIcon = document.createElement('div');
    markIcon.className = 'mark-reveal-icon';
    markIcon.textContent = '🎯';
    markIcon.title = 'Revealed mark (Akyros)';
    card.appendChild(markIcon);
  }

  if (ownerName) {
    const owner = document.createElement('div');
    owner.className = 'owner';
    owner.textContent = ownerName;
    card.appendChild(owner);
  }

  const portraitWrap = document.createElement('div');
  portraitWrap.className = 'portrait-wrap';
  const portrait = document.createElement('img');
  portrait.className = 'portrait';
  portrait.src = `assets/portraits/${character.id}.png`;
  portrait.alt = def.name;
  portraitWrap.appendChild(portrait);
  card.appendChild(portraitWrap);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = def.name;
  card.appendChild(name);

  const role = document.createElement('div');
  role.className = 'role';
  role.textContent = def.role;
  card.appendChild(role);

  if (character.isKO) {
    const dead = document.createElement('span');
    dead.className = 'badge dead';
    dead.textContent = 'KO\'D';
    card.appendChild(dead);
  } else {
    const hearts = document.createElement('div');
    hearts.className = 'hearts-row';
    for (let i = 0; i < character.maxHearts; i++) {
      const pip = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      pip.setAttribute('viewBox', '0 0 24 24');
      pip.setAttribute('class', 'heart-pip' + (i < character.hearts ? '' : ' empty'));
      pip.innerHTML = '<path fill="currentColor" d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5c2 0 3.5 1.2 4.5 2.5C12 6.2 13.5 5 15.5 5 19 5 21.5 8.5 20 12.5 18.5 16.65 12 21 12 21z"/>';
      hearts.appendChild(pip);
    }
    card.appendChild(hearts);

    const badges = document.createElement('div');
    if (character.shield > 0) {
      badges.appendChild(makeBadge(`🛡 ${character.shield}`, 'shield'));
    }
    if (isCursed) badges.appendChild(makeBadge('Cursed by Athena', 'cursed'));
    badges.append(...statusBadges(character));
    card.appendChild(badges);
  }

  return card;
}

function makeBadge(text, cls) {
  const el = document.createElement('span');
  el.className = 'badge' + (cls ? ' ' + cls : '');
  el.textContent = text;
  return el;
}

function statusBadges(character) {
  const badges = [];
  if (character.skipNextTurn) badges.push(makeBadge('Frozen - skips turn', 'frozen'));
  if (character.untargetable) badges.push(makeBadge('Untargetable', 'frozen'));
  if (character.usedSpecial) badges.push(makeBadge('Special used', 'warn'));

  switch (character.id) {
    case 'tharox':
      if (character.special.hasCharge) badges.push(makeBadge('Charge ready', 'warn'));
      break;
    case 'zerathys':
      badges.push(makeBadge(`Charge: ${character.special.chargeCount}/2`));
      break;
    case 'blade':
      if (character.special.streakCount > 0) {
        badges.push(makeBadge(`Streak x${character.special.streakCount}`, 'warn'));
      }
      break;
    case 'velorya':
      if (character.special.lastTargetId) {
        const lastName = CHARACTERS[character.special.lastTargetId]?.name || character.special.lastTargetId;
        badges.push(makeBadge(`Last hit: ${lastName} (hit again = -1, new target = -2)`, 'warn'));
      } else if (character.special.hasActedOnce) {
        badges.push(makeBadge('No Moonstep memory yet', 'warn'));
      }
      break;
  }
  return badges;
}

// Renders a "CURSED" badge on whichever character is currently cursed by an Athena in the game.
export function cursedCharacterId(game) {
  const athena = Object.values(game.characters).find((c) => c.id === 'athena');
  return athena ? athena.special.curseTargetCharacterId : null;
}

// Who's genuinely still under Chronox's Time Freeze, based on his ongoing
// freezeActive state rather than the target's skipNextTurn flag - that flag
// gets consumed to false the instant their turn is skipped, then only set
// back to true on Chronox's NEXT turn if the continuation flip is heads.
// Driving the visual off skipNextTurn alone made the ice effect flicker off
// in that gap even though the freeze was still conceptually active.
export function frozenCharacterId(game) {
  const chronox = Object.values(game.characters).find((c) => c.id === 'chronox');
  return chronox && chronox.special.freezeActive ? chronox.special.freezeTargetId : null;
}

// Character ids whose Akyros mark has been publicly revealed (via a Fatal
// Slash landing on them) - unlike the hidden mark set, this is safe to show
// on the shared screen. Clears automatically if Akyros is KO'd.
export function revealedMarkedCharacterIds(game) {
  const akyros = Object.values(game.characters).find((c) => c.id === 'akyros');
  return akyros ? akyros.special.revealedMarks : new Set();
}
