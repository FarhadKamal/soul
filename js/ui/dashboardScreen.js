import { CHARACTERS } from '../data/characters.js';
import {
  getUsableActions, executeAction, beginCharacterTurn, currentPlayer,
  charactersActingThisTurn, hasCharacterActedThisTurn, markCharacterActed,
  endTurn, consumeSkipIfFrozen, snapshot, resolveJesterBall, isValidTarget,
} from '../engine/turnEngine.js';
import { renderCharacterCard, cursedCharacterId, frozenCharacterId, revealedMarkedCharacterIds } from './characterCard.js';
import { renderLogPanel } from './logPanel.js';
import { showModal } from './modal.js';
import { askDefenderRPSChoice, showRPSReveal } from './coinFlipView.js';
import { pickSystemRPS, resolveRPS } from '../engine/random.js';
import { playActionSound, playUiClick, playKO, playVictory, playCoin, playSound, startTickLoop, stopTickLoop } from '../engine/sound.js';

const COIN_FLIP_ACTIONS = new Set(['cyclonePunch']);
const RPS_ACTIONS = new Set(['chaosGamble']);
const ACTION_TIMER_SECONDS = 20;

export function renderDashboard(container, game, { onRestart }) {
  let undoSnapshot = null;
  // armedAction: { characterId, actionId, label, targetFilter, onPicked }
  let armedAction = null;
  let jesterBallPromptShownFor = null;
  let victorySoundPlayed = false;
  // Character ids that took real damage in the action that just resolved -
  // read once by the next render() to trigger a hit-flash, then cleared.
  let flashCharacterIds = new Set();
  // Character ids to show a one-time divine-light burst on (Athena's
  // Divine Restore) - same consume-once-per-render pattern as the hit flash.
  let divineLightCharacterIds = new Set();
  // Character ids to show a one-time resurrection burst on (Blade's
  // Rebirth) - same consume-once-per-render pattern as the hit flash.
  let reviveCharacterIds = new Set();

  function markHitFromResult(result) {
    if (!result) return;
    if (result.amountDealt > 0 && result.targetCharacterId) {
      flashCharacterIds.add(result.targetCharacterId);
    }
    if (result.mirrorResult) markHitFromResult(result.mirrorResult);
  }
  // actionTimer: { characterId, intervalId, remaining } - only runs while the
  // active character is choosing their main action (not during target
  // selection, coin flips, RPS, or the Jester Ball modal).
  let actionTimer = null;
  // targetTimer: same shape as actionTimer, but covers the "choose a target"
  // step once an action has been armed - prevents a player from stalling
  // indefinitely by picking an action and then never picking a target.
  let targetTimer = null;

  function clearActionTimer() {
    if (actionTimer) {
      clearInterval(actionTimer.intervalId);
      actionTimer = null;
      stopTickLoop();
    }
  }

  function clearTargetTimer() {
    if (targetTimer) {
      clearInterval(targetTimer.intervalId);
      targetTimer = null;
      stopTickLoop();
    }
  }

  function startTargetTimer() {
    clearTargetTimer();
    startTickLoop();
    const armedAtStart = armedAction;
    targetTimer = { remaining: ACTION_TIMER_SECONDS, intervalId: null };
    targetTimer.intervalId = setInterval(() => {
      targetTimer.remaining -= 1;
      const el = document.getElementById('target-timer-count');
      if (el) el.textContent = String(targetTimer.remaining);
      if (targetTimer.remaining <= 0) {
        clearTargetTimer();
        autoPickRandomTargetFor(armedAtStart);
      }
    }, 1000);
  }

  function autoPickRandomTargetFor(action) {
    if (!action || armedAction !== action) return; // stale timer, already resolved/cancelled
    const validTargets = Object.keys(game.characters).filter((tid) => {
      if (action.targetFilter) return action.targetFilter(tid);
      return isValidTarget(game, action.characterId, action.actionId, tid);
    });
    if (validTargets.length === 0) {
      armedAction = null;
      render();
      return;
    }
    const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
    armedAction = null;
    action.onPicked(targetId);
  }

  function startActionTimer(characterId) {
    clearActionTimer();
    startTickLoop();
    actionTimer = { characterId, remaining: ACTION_TIMER_SECONDS, intervalId: null };
    actionTimer.intervalId = setInterval(() => {
      actionTimer.remaining -= 1;
      const el = document.getElementById('action-timer-count');
      if (el) el.textContent = String(actionTimer.remaining);
      if (actionTimer.remaining <= 0) {
        clearActionTimer();
        autoPickRandomMove(characterId);
      }
    }, 1000);
  }

  function autoPickRandomMove(characterId) {
    const character = game.characters[characterId];
    if (!character || character.isKO) return;
    const options = getUsableActions(character, game);
    if (options.length === 0) return;
    const action = options[Math.floor(Math.random() * options.length)];
    pushUndoSnapshot();
    if (!action.needsTarget) {
      runResolvedAction(characterId, action.actionId, null, true);
      return;
    }
    const validTargets = Object.keys(game.characters).filter((tid) =>
      isValidTarget(game, characterId, action.actionId, tid)
    );
    if (validTargets.length === 0) return;
    const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
    runResolvedAction(characterId, action.actionId, targetId, true);
  }

  function pickRandomTarget(characterId, actionId) {
    const validTargets = Object.keys(game.characters).filter((tid) =>
      isValidTarget(game, characterId, actionId, tid)
    );
    if (validTargets.length === 0) return null;
    return validTargets[Math.floor(Math.random() * validTargets.length)];
  }

  function pushUndoSnapshot() {
    undoSnapshot = snapshot(game);
  }

  function render() {
    container.innerHTML = '';

    if (game.phase === 'game-over') {
      clearActionTimer();
      clearTargetTimer();
      if (!victorySoundPlayed) {
        victorySoundPlayed = true;
        if (game.winnerPlayerId) playVictory();
      }
      container.appendChild(renderGameOver());
      return;
    }

    const activeCharId = getActingCharacterId();
    maybeShowJesterBallPrompt(activeCharId);

    const wrap = document.createElement('div');
    wrap.className = 'dashboard';
    wrap.appendChild(renderTopBar());
    wrap.appendChild(renderBoard(activeCharId));
    flashCharacterIds = new Set(); // consumed for this render only
    divineLightCharacterIds = new Set(); // consumed for this render only
    reviveCharacterIds = new Set(); // consumed for this render only
    wrap.appendChild(renderActionPanel(activeCharId));
    wrap.appendChild(renderLogPanel(game.log));
    container.appendChild(wrap);
  }

  function renderGameOver() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard';

    const winner = game.players.find((p) => p.id === game.winnerPlayerId);
    const isDraw = !winner;

    const banner = document.createElement('div');
    banner.className = 'game-over-banner';

    const crown = document.createElement('div');
    crown.className = 'victory-crown';
    crown.textContent = isDraw ? '🤝' : '👑';
    banner.appendChild(crown);

    const h1 = document.createElement('h1');
    h1.textContent = isDraw ? "It's a Draw!" : `${winner.name} Wins!`;
    banner.appendChild(h1);

    const sub = document.createElement('div');
    sub.className = 'victory-subtitle';
    sub.textContent = isDraw
      ? `All remaining players were eliminated simultaneously after ${game.round} round${game.round === 1 ? '' : 's'}`
      : `Victorious after ${game.round} round${game.round === 1 ? '' : 's'}`;
    banner.appendChild(sub);

    const portraitCharacterIds = isDraw
      ? Object.keys(game.characters)
      : winner.characterIds;

    const portraitRow = document.createElement('div');
    portraitRow.className = 'victory-portraits';
    portraitCharacterIds.forEach((charId) => {
      const character = game.characters[charId];
      const def = CHARACTERS[charId];
      const box = document.createElement('div');
      box.className = 'victory-portrait-box' + (character.isKO ? ' ko' : '');
      const img = document.createElement('img');
      img.src = `assets/portraits/${charId}.png`;
      img.alt = def.name;
      box.appendChild(img);
      const label = document.createElement('div');
      label.className = 'victory-portrait-name';
      label.textContent = def.name;
      box.appendChild(label);
      portraitRow.appendChild(box);
    });
    banner.appendChild(portraitRow);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'New Match';
    btn.onclick = onRestart;
    banner.appendChild(btn);

    wrap.appendChild(banner);

    const logHeading = document.createElement('h3');
    logHeading.textContent = 'Full Match Log';
    logHeading.style.margin = '0 0 8px';
    logHeading.style.color = 'var(--gold)';
    wrap.appendChild(logHeading);
    const logPanel = renderLogPanel(game.log);
    logPanel.style.maxHeight = '400px';
    wrap.appendChild(logPanel);

    return wrap;
  }

  function renderTopBar() {
    const bar = document.createElement('div');
    bar.className = 'top-bar';

    const banner = document.createElement('div');
    banner.className = 'turn-banner';
    const player = currentPlayer(game);
    banner.innerHTML = `Round ${game.round} — <strong>${player.name}'s Turn</strong>`;
    bar.appendChild(banner);

    const actions = document.createElement('div');
    actions.className = 'top-bar-actions';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-small';
    undoBtn.textContent = 'Undo Last Action';
    undoBtn.disabled = !undoSnapshot;
    undoBtn.onclick = () => {
      if (!undoSnapshot) return;
      playUiClick();
      clearActionTimer();
      clearTargetTimer();
      Object.assign(game, undoSnapshot);
      undoSnapshot = null;
      armedAction = null;
      jesterBallPromptShownFor = null;
      render();
    };
    actions.appendChild(undoBtn);

    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn btn-small btn-danger';
    restartBtn.textContent = 'Restart Match';
    restartBtn.onclick = () => {
      playUiClick();
      showModal({
        title: 'Restart Match?',
        body: 'This will discard the current match and return to character setup.',
        actions: [
          { label: 'Cancel' },
          { label: 'Restart', primary: true, onClick: () => { clearActionTimer(); clearTargetTimer(); onRestart(); } },
        ],
      });
    };
    actions.appendChild(restartBtn);

    bar.appendChild(actions);
    return bar;
  }

  const PLAYER_COLOR_CLASSES = ['team-1', 'team-2', 'team-3', 'team-4'];

  function renderBoard(activeCharId) {
    const board = document.createElement('div');
    board.className = 'board';
    const curseId = cursedCharacterId(game);
    const frozenId = frozenCharacterId(game);
    const markedIds = revealedMarkedCharacterIds(game);
    const activePlayerId = currentPlayer(game).id;

    game.players.forEach((player, playerIndex) => {
      const group = document.createElement('div');
      group.className = 'team-group' + (player.id === activePlayerId ? ' active-team' : '');

      const header = document.createElement('div');
      header.className = 'team-header ' + PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length];
      header.textContent = player.name + (player.id === activePlayerId ? ' (current turn)' : '');
      group.appendChild(header);

      const cardsRow = document.createElement('div');
      cardsRow.className = 'team-cards';

      player.characterIds.forEach((charId) => {
        const character = game.characters[charId];
        const isTargetable = !!armedAction && isLegalTarget(character.id);
        const card = renderCharacterCard(character, {
          isActing: character.id === activeCharId,
          isTargetable,
          isCursed: character.id === curseId,
          isFrozenVisual: character.id === frozenId,
          isRevealedMarked: markedIds.has(character.id),
          isHit: flashCharacterIds.has(character.id),
          isDivineLight: divineLightCharacterIds.has(character.id),
          isRevived: reviveCharacterIds.has(character.id),
          ownerName: player.name,
          ownerColorClass: PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length],
          onTargetClick: (targetId) => handleTargetPicked(targetId),
        });
        cardsRow.appendChild(card);
      });

      group.appendChild(cardsRow);
      board.appendChild(group);
    });
    return board;
  }

  function renderActionPanel(activeCharId) {
    const panel = document.createElement('div');
    panel.className = 'action-panel';

    if (!activeCharId) {
      clearActionTimer();
      clearTargetTimer();
      panel.innerHTML = '<h3>All characters have acted. Ending turn...</h3>';
      setTimeout(() => {
        endTurn(game);
        armedAction = null;
        render();
      }, 400);
      return panel;
    }

    const character = game.characters[activeCharId];
    const def = CHARACTERS[activeCharId];
    const h3 = document.createElement('h3');
    h3.textContent = `${def.name}'s turn`;
    panel.appendChild(h3);

    if (armedAction) {
      clearActionTimer();
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = `Choose a target for ${armedAction.label}...`;
      panel.appendChild(hint);

      const timerEl = document.createElement('div');
      timerEl.className = 'action-timer';
      timerEl.innerHTML = `Auto-target in <span id="target-timer-count">${targetTimer ? targetTimer.remaining : ACTION_TIMER_SECONDS}</span>s`;
      panel.appendChild(timerEl);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-small';
      cancelBtn.style.marginTop = '8px';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => { clearTargetTimer(); armedAction = null; render(); };
      panel.appendChild(cancelBtn);
      return panel;
    }

    const isBallHolderPrompt = game.jesterBall && game.jesterBall.holderCharacterId === activeCharId
      && !hasCharacterActedThisTurn(game, activeCharId);

    if (isBallHolderPrompt) {
      clearActionTimer();
    } else if (!actionTimer || actionTimer.characterId !== activeCharId) {
      startActionTimer(activeCharId);
    }

    const legalActions = getUsableActions(character, game);

    if (!isBallHolderPrompt) {
      const timerEl = document.createElement('div');
      timerEl.className = 'action-timer';
      timerEl.innerHTML = `Auto-move in <span id="action-timer-count">${actionTimer ? actionTimer.remaining : ACTION_TIMER_SECONDS}</span>s`;
      panel.appendChild(timerEl);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';
    legalActions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = action.label;
      btn.onclick = () => { clearActionTimer(); playUiClick(); onActionChosen(activeCharId, action); };
      btnRow.appendChild(btn);
    });
    panel.appendChild(btnRow);
    return panel;
  }

  function onActionChosen(characterId, action) {
    if (!action.needsTarget) {
      pushUndoSnapshot();
      runResolvedAction(characterId, action.actionId, null);
      return;
    }

    armAction(characterId, action.actionId, action.label, (targetId) => {
      pushUndoSnapshot();
      runResolvedAction(characterId, action.actionId, targetId);
    });
  }

  function armAction(characterId, actionId, label, onPicked, targetFilter) {
    armedAction = { characterId, actionId, label, onPicked, targetFilter };
    startTargetTimer();
    render();
  }

  function playPostActionSounds(actionId, targetId, logBefore) {
    const recentLog = logBefore !== undefined ? game.log.slice(logBefore) : [];
    // Don't assume the revived character is the direct target - Athena's
    // curse mirror can trigger Blade's Rebirth on a completely different
    // character (the cursed player, not whoever was actually attacked).
    const rebirthEntry = recentLog.find((e) => e.type === 'rebirth');
    if (rebirthEntry) {
      playSound('rebirth');
      reviveCharacterIds.add(rebirthEntry.targetCharacterId);
      return;
    }
    const wasDodged = recentLog.some((e) => e.type === 'dodge' && e.targetCharacterId === targetId);
    if (wasDodged) {
      playSound('dodge');
      return;
    }
    playActionSound(actionId);
    const target = targetId && game.characters[targetId];
    // Skip the KO sound if this hit ended the match - the victory fanfare
    // covers it instead, so both firing together would be redundant/messy.
    if (target?.isKO && game.phase !== 'game-over') {
      setTimeout(() => playKO(), 200);
    }
  }

  async function runResolvedAction(characterId, actionId, targetId, isAuto = false) {
    if (COIN_FLIP_ACTIONS.has(actionId)) {
      // The coin flip still happens internally (decides 1 vs 2 damage) but
      // no heads/tails modal - the damage number and hit-flash already make
      // the outcome obvious without an extra click-through step.
      const logBefore = game.log.length;
      const coinResult = executeAction(game, characterId, actionId, targetId);
      markHitFromResult(coinResult);
      playCoin();
      playPostActionSounds(actionId, targetId, logBefore);
      return finishAction(characterId);
    }

    if (RPS_ACTIONS.has(actionId)) {
      const logBefore = game.log.length;
      const attackerName = CHARACTERS[characterId].name;
      const defenderName = CHARACTERS[targetId].name;
      const systemChoice = pickSystemRPS(); // hidden until the reveal below
      const defenderChoice = await askDefenderRPSChoice({ defenderName });
      const outcome = resolveRPS(systemChoice, defenderChoice);
      await showRPSReveal(systemChoice, defenderChoice, outcome, { attackerName, defenderName });
      const rpsResult = executeAction(game, characterId, actionId, targetId, outcome);
      markHitFromResult(rpsResult);
      if (outcome !== 'lose') {
        playPostActionSounds(actionId, targetId, logBefore);
      }
      return finishAction(characterId);
    }

    if (actionId === 'soulSwap') {
      executeAction(game, characterId, 'soulSwap', targetId);
      playActionSound('soulSwap');

      if (isAuto) {
        // The whole move was auto-picked (turn timer expired) - the free
        // follow-up must also resolve automatically, otherwise it would sit
        // armed waiting for a target click that may never come.
        const freeTargetId = pickRandomTarget(characterId, 'soulSwapWrath');
        if (freeTargetId) {
          const logBefore2 = game.log.length;
          const wrathResult = executeAction(game, characterId, 'soulSwapWrath', freeTargetId);
          markHitFromResult(wrathResult);
          playPostActionSounds('soulSwapWrath', freeTargetId, logBefore2);
        }
        finishAction(characterId);
        return;
      }

      // Do NOT mark Zerathys as acted yet - he still owes the free Thunder
      // Wrath follow-up, and marking him now would let the turn engine
      // advance to the player's other character mid-chain.
      armAction(characterId, 'soulSwapWrath', 'Thunder Wrath (free, from Soul Swap)', (freeTargetId) => {
        pushUndoSnapshot();
        const logBefore2 = game.log.length;
        const wrathResult2 = executeAction(game, characterId, 'soulSwapWrath', freeTargetId);
        markHitFromResult(wrathResult2);
        playPostActionSounds('soulSwapWrath', freeTargetId, logBefore2);
        finishAction(characterId);
      });
      return;
    }

    const logBefore = game.log.length;
    const result = executeAction(game, characterId, actionId, targetId);
    markHitFromResult(result);
    // Divine Restore and Glory Smash both self-heal + self-shield the
    // caster (Glory Smash also hits its target, already covered by the
    // hit-flash above via markHitFromResult) - flag the caster for the
    // same golden self-buff burst, but ONLY if the buff actually landed.
    // applyHeal/applyShield both no-op if the caster is already KO'd (e.g.
    // Athena's curse mirror can kill Glory Smash's caster before his own
    // self-heal runs) - showing a "healed" sparkle on a character who just
    // got knocked out and gained nothing would be misleading.
    if ((actionId === 'divineRestore' || actionId === 'glorySmash') && !game.characters[characterId].isKO) {
      divineLightCharacterIds.add(characterId);
    }
    playPostActionSounds(actionId, targetId, logBefore);
    finishAction(characterId);
  }

  function finishAction(characterId) {
    armedAction = null;
    markCharacterActed(game, characterId);
    render();
  }

  function isLegalTarget(targetId) {
    if (!armedAction) return false;
    if (armedAction.targetFilter) return armedAction.targetFilter(targetId);
    return isValidTarget(game, armedAction.characterId, armedAction.actionId, targetId);
  }

  function handleTargetPicked(targetId) {
    if (!armedAction || !isLegalTarget(targetId)) return;
    clearTargetTimer();
    const { onPicked } = armedAction;
    armedAction = null;
    onPicked(targetId);
  }

  function getActingCharacterId() {
    const acting = charactersActingThisTurn(game);
    for (const character of acting) {
      if (hasCharacterActedThisTurn(game, character.id)) continue;
      if (game.jesterBall && game.jesterBall.holderCharacterId === character.id) {
        return character.id; // let the ball prompt resolve their turn instead of normal actions
      }
      if (consumeSkipIfFrozen(character)) {
        game.log.push({ type: 'passive', characterId: character.id, text: `${CHARACTERS[character.id].name} is frozen and skips their turn.` });
        markCharacterActed(game, character.id);
        continue;
      }
      if (!game.turnStartFiredFor.has(character.id)) {
        game.turnStartFiredFor.add(character.id);
        beginCharacterTurn(character, game, game.log);
      }
      if (getUsableActions(character, game).length === 0) {
        game.log.push({ type: 'passive', characterId: character.id, text: `${CHARACTERS[character.id].name} has no valid targets and skips their turn.` });
        markCharacterActed(game, character.id);
        continue;
      }
      return character.id;
    }
    return null;
  }

  function maybeShowJesterBallPrompt(activeCharId) {
    if (!game.jesterBall) return;
    const holderId = game.jesterBall.holderCharacterId;
    if (activeCharId !== holderId) return;
    if (hasCharacterActedThisTurn(game, holderId)) return;
    if (jesterBallPromptShownFor === holderId) return;
    jesterBallPromptShownFor = holderId;

    const isValidPassTarget = (targetId) => {
      const t = game.characters[targetId];
      // Can't pass to self, and passing back to Boingo (the original
      // thrower) is already covered by "Return" - offering it here too
      // would let Boingo end up "holding" his own ball.
      return t && !t.isKO && t.id !== holderId && t.id !== game.jesterBall.thrownByCharacterId;
    };
    const hasValidPassTarget = Object.keys(game.characters).some(isValidPassTarget);
    const canPass = game.jesterBall.canPass && hasValidPassTarget;

    const rawActions = [
      { label: 'Return to Boingo', onClick: () => finishJesterBall('return_') },
    ];
    if (canPass) {
      rawActions.push({
        label: 'Pass to another player',
        onClick: () => {
          armAction(holderId, '__jesterPass', 'Pass Jester Ball', (targetId) => {
            pushUndoSnapshot();
            finishJesterBall('pass', targetId);
          }, isValidPassTarget);
        },
      });
    }
    rawActions.push({ label: 'Take it (-4 hearts)', onClick: () => finishJesterBall('take') });

    setTimeout(() => {
      pushUndoSnapshot();

      let remaining = ACTION_TIMER_SECONDS;
      let settled = false;
      const body = document.createElement('div');
      body.innerHTML = `
        <p>Choose what to do with it.</p>
        <div class="action-timer">Auto-choice in <span id="jesterball-timer-count">${remaining}</span>s</div>
      `;

      const wrappedActions = rawActions.map((a) => ({
        ...a,
        onClick: () => {
          if (settled) return;
          settled = true;
          clearInterval(intervalId);
          stopTickLoop();
          a.onClick();
        },
      }));

      showModal({
        title: `${CHARACTERS[holderId].name} is holding the Jester Ball`,
        body,
        actions: wrappedActions,
      });

      startTickLoop();
      const intervalId = setInterval(() => {
        remaining -= 1;
        const el = document.getElementById('jesterball-timer-count');
        if (el) el.textContent = String(remaining);
        if (remaining <= 0) {
          settled = true;
          clearInterval(intervalId);
          stopTickLoop();
          document.querySelector('.modal-overlay')?.remove();
          // Call the RAW (unwrapped) action directly - the wrapped versions
          // guard on `settled`, which is already true by this point and
          // would otherwise silently swallow this auto-pick.
          const choice = rawActions[Math.floor(Math.random() * rawActions.length)];
          choice.onClick();
        }
      }, 1000);
    }, 0);
  }

  function finishJesterBall(choice, targetId) {
    const holderId = game.jesterBall.holderCharacterId;
    const logBefore = game.log.length;
    const ballResult = resolveJesterBall(game, holderId, choice, targetId);
    markHitFromResult(ballResult);
    jesterBallPromptShownFor = null;
    if (choice === 'pass') playSound('kick');
    else if (choice === 'take') {
      const rebirthEntry = game.log.slice(logBefore).find((e) => e.type === 'rebirth');
      if (rebirthEntry) {
        playSound('rebirth');
        reviveCharacterIds.add(rebirthEntry.targetCharacterId);
      } else {
        playSound('smash'); // the ball explodes on the holder
        const holder = game.characters[holderId];
        if (holder?.isKO && game.phase !== 'game-over') setTimeout(() => playKO(), 200);
      }
    }
    else playSound('magic');
    // Return/Pass consume the holder's turn action. Take does NOT - the
    // holder still gets their normal action afterward this same turn.
    if (choice !== 'take') {
      markCharacterActed(game, holderId);
    }
    render();
  }

  render();
}
