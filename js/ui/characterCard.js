import { CHARACTERS } from '../data/characters.js';

export function renderCharacterCard(character, {
  isActing, isTargetable, onTargetClick, isCursed, isHit, isFrozenVisual, isRevealedMarked,
  isDivineLight, isRevived, isShaking, isClawed, clawCount, isDodging, isSmoking, isHoldingBall,
  isBallDropTarget, isBallClickTarget, onBallDrop, onBallIconTap, onBallIconDragStart, isBallArmed,
  ownerName, ownerColorClass,
}) {
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
  if (isShaking && !character.isKO) card.classList.add('hard-shake');
  if (isDodging && !character.isKO) card.classList.add('dodge-skew');
  if (isTargetable) {
    card.classList.add('targetable');
    card.onclick = () => onTargetClick(character.id);
  }

  if (isBallDropTarget) {
    // Always wired so a real mouse drag-and-drop works immediately -
    // dragging is inherently deliberate, no extra gate needed.
    card.classList.add('ball-drop-target');
    card.ondragover = (e) => e.preventDefault();
    card.ondrop = (e) => { e.preventDefault(); onBallDrop(character.id); };
    if (isBallClickTarget) {
      // Only wired once the holder has tapped the ball icon first (touch
      // fallback for drag) - prevents an unrelated/accidental card tap
      // from silently resolving the ball.
      card.classList.add('ball-click-armed');
      card.onclick = () => onBallDrop(character.id);
    }
  }

  if (isRevealedMarked && !character.isKO) {
    const markIcon = document.createElement('div');
    markIcon.className = 'mark-reveal-icon';
    markIcon.textContent = '🎯';
    markIcon.title = 'Revealed mark (Akyros)';
    card.appendChild(markIcon);
  }

  if (isClawed && !character.isKO) {
    const claw = document.createElement('div');
    claw.className = 'claw-scratch';
    // More claws for higher-streak Blood Hunt hits (or Shadow Execution,
    // which always passes 3) - capped so it stays readable at high streaks.
    const count = Math.max(1, Math.min(clawCount || 3, 6));
    claw.innerHTML = Array.from({ length: count }, (_, i) =>
      `<span style="left:${(100 / (count + 1)) * (i + 1)}%; animation-delay:${i * 0.08}s"></span>`
    ).join('');
    card.appendChild(claw);
  }

  if (isSmoking && !character.isKO) {
    const smoke = document.createElement('div');
    smoke.className = 'smoke-burst';
    smoke.innerHTML = '<span></span><span></span><span></span><span></span>';
    card.appendChild(smoke);
  }

  if (isHoldingBall && !character.isKO) {
    const ball = document.createElement('div');
    ball.className = 'jesterball-holding-icon';
    ball.textContent = '💣';
    if (onBallIconTap) {
      // This card belongs to the current holder on their own turn - the
      // ball is grabbable: drag it (mouse) or tap it then tap a target
      // (touch), instead of it just sitting there as a passive icon.
      ball.classList.add('grabbable');
      if (isBallArmed) ball.classList.add('armed');
      ball.title = 'Drag onto Boingo (Return) or another player (Pass)';
      ball.draggable = true;
      ball.ondragstart = (e) => { e.stopPropagation(); onBallIconDragStart(); };
      ball.onclick = (e) => { e.stopPropagation(); onBallIconTap(); };
    } else {
      ball.title = 'Holding the Jester Ball';
    }
    card.appendChild(ball);
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
  // Switch to the injured portrait once hurt down to half health or below -
  // KO'd characters keep the injured look too rather than reverting.
  const isInjured = !character.isKO && character.hearts <= character.maxHearts / 2;
  portrait.src = isInjured || character.isKO
    ? `assets/images/injured/${character.id}.jpg`
    : `assets/portraits/${character.id}.png`;
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
  }
  return badges;
}

// Drives the cursed-mark visual effect on whichever character is currently cursed by an Athena in the game.
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

// Who's currently holding the Jester Ball - persists on their card until
// they resolve it (Return/Pass/Take), unlike the one-shot burst effects.
export function jesterBallHolderCharacterId(game) {
  return game.jesterBall ? game.jesterBall.holderCharacterId : null;
}
