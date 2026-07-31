import { CHARACTERS } from '../data/characters.js';

export function renderCharacterCard(character, {
  isActing, isTargetable, onTargetClick, isCursed, isHit, isFrozenVisual, isRevealedMarked,
  isDivineLight, isRevived, isShaking, isClawed, clawCount, isDodging, isSmoking, isLaughing, isAthenaHealing, isTharoxGlory, isZerathysSoul, isAkyrosShadow, isChronoxTime, isAkyrosDodge, isBoingoHardpunch, isBoingoMiss, isChronoxCyclone, isAkyrosHidden, isZerathysCharge, isTharoxToss, isAthenaCurse, isVeloryaStrike, isBladeStrike, isZerathysStrike, isTharoxSmash, isAkyrosFatal, isBoingoThrowing, isVeloryaCasting, isBoingoNormalpunch, isHoldingBall,
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
  // KO'd characters keep the injured look too rather than reverting. Blade
  // gets a special "back from the dead" portrait for the rest of the match
  // once his Rebirth has actually triggered, taking priority over the
  // ordinary injured look (Rebirth always leaves him well below half health).
  // Boingo briefly flashes a laughing portrait when the Jester Ball pays off
  // for him (explodes on someone else, or comes back to heal him), a
  // throwing portrait when he casts Jester Ball, a hard-punch portrait when
  // a Chaos Gamble "win" roll lands, or a miss portrait when a Chaos Gamble
  // "lose" roll whiffs, Athena briefly flashes
  // a healing portrait when Divine Restore triggers OR a curse portrait when
  // Curse Strike is cast, Tharox briefly flashes a portrait when Glory Smash
  // triggers, plain Smash OR Titan Smash lands (NOT Glory Smash, which has
  // its own portrait), OR Titan Toss triggers, Zerathys briefly flashes a
  // portrait when Thunder Wrath lands (covers both the normal action and the
  // free Soul Swap follow-up), Soul Swap itself triggers, OR Charge Up
  // triggers, Akyros briefly flashes a portrait when he dodges an attack,
  // Shadow Execution lands, Hidden Mark is cast, OR Fatal Slash lands,
  // Chronox briefly flashes a portrait when Time Freeze OR Cyclone Punch
  // triggers, Velorya briefly flashes a portrait when Lunar Strike OR
  // Moonstep lands, and Blade briefly flashes a portrait when Blood Hunt
  // lands - all timed overrides on top of everything else (see setLaughing/
  // setBoingoThrowing/setAthenaHealing/setAthenaCurse/setTharoxGlory/
  // setTharoxSmash/setZerathysSoul/setZerathysStrike/setAkyrosShadow/
  // setAkyrosDodge/setAkyrosFatal/setBoingoHardpunch/setBoingoMiss/
  // setChronoxTime/setChronoxCyclone/setAkyrosHidden/setZerathysCharge/
  // setTharoxToss/setVeloryaStrike/setBladeStrike in dashboardScreen.js).
  // Laughing takes priority over throwing/hard-punch/miss; for Athena,
  // Divine Restore (her rarer self-heal special) beats Curse Strike (her
  // routine every-turn action);
  // for Akyros, dodge (a reactive moment) beats Shadow Execution (an
  // eventful special) beats Hidden Mark (his routine setup move) beats Fatal
  // Slash (his everyday attack); for Zerathys, Thunder Wrath (the actual
  // hit) beats Soul Swap (the setup special) beats Charge Up (his routine
  // setup move); for Tharox, Glory Smash (his special) beats Smash/Titan
  // Smash (the actual hit) beats Titan Toss (his routine setup move); Time
  // Freeze (Chronox's rarer special) beats Cyclone Punch (his every-turn
  // normal attack) - in the unlikely case multiple flags flash at once.
  // Velorya's Lunar Strike/Moonstep flash takes priority over her persistent
  // "hidden" eclipse portrait - she still attacks while eclipsed (it's her
  // only offense), so the strike flash should briefly show even mid-eclipse,
  // then fall back to "hidden" once the flash timer ends. Blade's Blood Hunt
  // flash similarly takes priority over his persistent "alive" post-Rebirth
  // portrait, for the same reason - he keeps attacking after reviving, and
  // the strike flash should still show, falling back to "alive" between
  // hits. Both "hidden" and "alive" in turn take priority over the
  // respective character's injured look.
  const isInjured = !character.isKO && character.hearts <= character.maxHearts / 2;
  if (character.id === 'boingo' && isLaughing && !character.isKO) {
    portrait.src = 'assets/images/boingo_laughing.jpg';
  } else if (character.id === 'boingo' && isBoingoThrowing && !character.isKO) {
    portrait.src = 'assets/images/boingo_throwing.jpg';
  } else if (character.id === 'boingo' && isBoingoHardpunch && !character.isKO) {
    portrait.src = 'assets/images/boingo_hardpunch.jpg';
  } else if (character.id === 'boingo' && isBoingoNormalpunch && !character.isKO) {
    portrait.src = 'assets/images/boingo_normalpunch.jpg';
  } else if (character.id === 'boingo' && isBoingoMiss && !character.isKO) {
    portrait.src = 'assets/images/boingo_miss.jpg';
  } else if (character.id === 'athena' && isAthenaHealing && !character.isKO) {
    portrait.src = 'assets/images/athena_heal.jpg';
  } else if (character.id === 'athena' && isAthenaCurse && !character.isKO) {
    portrait.src = 'assets/images/athena_curse.jpg';
  } else if (character.id === 'tharox' && isTharoxGlory && !character.isKO) {
    portrait.src = 'assets/images/tharox_glory.jpg';
  } else if (character.id === 'tharox' && isTharoxSmash && !character.isKO) {
    portrait.src = 'assets/images/tharox_smash.jpg';
  } else if (character.id === 'tharox' && isTharoxToss && !character.isKO) {
    portrait.src = 'assets/images/tharox_toss.jpg';
  } else if (character.id === 'zerathys' && isZerathysStrike && !character.isKO) {
    portrait.src = 'assets/images/zerathys_strike.jpg';
  } else if (character.id === 'zerathys' && isZerathysSoul && !character.isKO) {
    portrait.src = 'assets/images/zerathys_soul.jpg';
  } else if (character.id === 'zerathys' && isZerathysCharge && !character.isKO) {
    portrait.src = 'assets/images/zerathys_charge.jpg';
  } else if (character.id === 'akyros' && isAkyrosDodge && !character.isKO) {
    portrait.src = 'assets/images/akyros_dodge.jpg';
  } else if (character.id === 'akyros' && isAkyrosShadow && !character.isKO) {
    portrait.src = 'assets/images/akyros_shadow.jpg';
  } else if (character.id === 'akyros' && isAkyrosHidden && !character.isKO) {
    portrait.src = 'assets/images/akyros_hidden.jpg';
  } else if (character.id === 'akyros' && isAkyrosFatal && !character.isKO) {
    portrait.src = 'assets/images/akyros_fatal.jpg';
  } else if (character.id === 'chronox' && isChronoxTime && !character.isKO) {
    portrait.src = 'assets/images/chronox_time.jpg';
  } else if (character.id === 'chronox' && isChronoxCyclone && !character.isKO) {
    portrait.src = 'assets/images/chronox_cyclone.jpg';
  } else if (character.id === 'velorya' && isVeloryaCasting && !character.isKO) {
    portrait.src = 'assets/images/velorya_casting.jpg';
  } else if (character.id === 'velorya' && isVeloryaStrike && !character.isKO) {
    portrait.src = 'assets/images/velorya_strike.jpg';
  } else if (character.id === 'velorya' && character.untargetable && !character.isKO) {
    portrait.src = 'assets/images/velorya_hided.jpg';
  } else if (character.id === 'blade' && isBladeStrike && !character.isKO) {
    portrait.src = 'assets/images/blade_strike.jpg';
  } else if (character.id === 'blade' && character.special.rebirthUsed) {
    portrait.src = 'assets/images/blade_alive.jpg';
  } else if (character.id === 'athena' && !character.isKO && character.hearts === character.maxHearts) {
    // Untouched all match (nobody has landed a hit on her yet) and at full
    // health - her default "unbothered" look, shown whenever no timed flash
    // (heal/curse) is active. Reverts the instant she takes any damage.
    portrait.src = 'assets/images/athena_kiss.jpg';
  } else {
    portrait.src = isInjured || character.isKO
      ? `assets/images/injured/${character.id}.jpg`
      : `assets/portraits/${character.id}.png`;
  }
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
