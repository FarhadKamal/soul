import { CHARACTERS } from '../data/characters.js';
import {
  getUsableActions, executeAction, beginCharacterTurn, currentPlayer,
  charactersActingThisTurn, hasCharacterActedThisTurn, markCharacterActed,
  endTurn, consumeSkipIfFrozen, snapshot, resolveJesterBall, isValidTarget,
} from '../engine/turnEngine.js';
import { renderCharacterCard, cursedCharacterId, frozenCharacterId, revealedMarkedCharacterIds, jesterBallHolderCharacterId } from './characterCard.js';
import { renderLogPanel, formatLogAsText } from './logPanel.js';
import { showModal } from './modal.js';
import { renderRulesModal } from './rulesScreen.js';
import { toggleFullscreen } from './fullscreen.js';
import { rollChaosGamble } from '../engine/random.js';
import { chooseBotMove, chooseBotJesterBallMove, chooseSoulSwapWrathTarget } from '../engine/botPlayer.js';
import { playActionSound, playUiClick, playKO, playVictory, playCoin, playSound, startTickLoop, stopTickLoop, startMenuMusic } from '../engine/sound.js';
import { getConsoleLogText } from '../engine/consoleCapture.js';

const COIN_FLIP_ACTIONS = new Set(['cyclonePunch']);
const CHAOS_GAMBLE_ACTIONS = new Set(['chaosGamble']);
const ACTION_TIMER_SECONDS = 20;

export function renderDashboard(container, game, { onRestart }) {
  let undoSnapshot = null;
  // armedAction: { characterId, actionId, label, targetFilter, onPicked }
  let armedAction = null;
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
  // Character ids to shake for a "hard hit" moment (Boingo RPS win,
  // Chronox Cyclone Punch on heads) - same consume-once-per-render pattern.
  let shakeCharacterIds = new Set();
  // Character ids to show a one-time claw-scratch slash on (Akyros's
  // Shadow Execution, Blade's Blood Hunt) - same consume-once-per-render
  // pattern. clawCounts maps characterId -> number of slashes to draw
  // (Blood Hunt scales this with streakCount; Shadow Execution is fixed).
  let clawCharacterIds = new Set();
  let clawCounts = new Map();
  // Character ids to show a one-time dodge-lean skew on (Akyros's Dodge) -
  // same consume-once-per-render pattern.
  let dodgeCharacterIds = new Set();
  // Character ids to show a one-time smoke/scorch burst on (Jester Ball
  // exploding on whoever "Takes" it) - same consume-once-per-render pattern.
  let smokeCharacterIds = new Set();
  // Character ids to briefly show Boingo's laughing portrait on - the ball
  // either exploded on someone else (his mischief paid off) or came back to
  // heal him. Always just Boingo himself. Unlike the other one-shot visual
  // flags (which are pure CSS animations that play out on their own once
  // triggered), this swaps an <img> src directly - so a portrait class alone
  // isn't enough, and clearing it on "next render" is unreliable since a
  // render can happen almost immediately after (e.g. a bot's turn starting).
  // Held open on an explicit timer instead so it's actually visible for a
  // fixed duration regardless of what else re-renders in between.
  let laughingCharacterIds = new Set();
  let laughingClearTimer = null;
  // Character ids to briefly show Athena's healing portrait on (Divine
  // Restore only, not Tharox's Glory Smash) - same explicit-timer pattern as
  // laughingCharacterIds above, for the same reason (a plain <img> src swap
  // needs its own fixed-duration hold, not "until next render").
  let athenaHealingCharacterIds = new Set();
  let athenaHealingClearTimer = null;
  // Character ids to briefly show Tharox's Glory Smash portrait on - same
  // explicit-timer pattern as the flags above.
  let tharoxGloryCharacterIds = new Set();
  let tharoxGloryClearTimer = null;
  // Character ids to briefly show Zerathys's Soul Swap portrait on - same
  // explicit-timer pattern as the flags above.
  let zerathysSoulCharacterIds = new Set();
  let zerathysSoulClearTimer = null;
  // Character ids to briefly show Akyros's Shadow Execution portrait on -
  // same explicit-timer pattern as the flags above.
  let akyrosShadowCharacterIds = new Set();
  let akyrosShadowClearTimer = null;
  // Character ids to briefly show Chronox's Time Freeze portrait on - same
  // explicit-timer pattern as the flags above.
  let chronoxTimeCharacterIds = new Set();
  let chronoxTimeClearTimer = null;
  // Character ids to briefly show Akyros's dodge portrait on - same
  // explicit-timer pattern as the flags above.
  let akyrosDodgeCharacterIds = new Set();
  let akyrosDodgeClearTimer = null;
  // Character ids to briefly show Boingo's hard-punch portrait on (a Chaos
  // Gamble "win" roll landing) - same explicit-timer pattern as the flags
  // above.
  let boingoHardpunchCharacterIds = new Set();
  let boingoHardpunchClearTimer = null;
  // Character ids to briefly show Boingo's miss portrait on (a Chaos Gamble
  // "lose" roll) - same explicit-timer pattern as the flags above.
  let boingoMissCharacterIds = new Set();
  let boingoMissClearTimer = null;
  // Character ids to briefly show Chronox's Cyclone Punch portrait on -
  // same explicit-timer pattern as the flags above.
  let chronoxCycloneCharacterIds = new Set();
  let chronoxCycloneClearTimer = null;
  // Character ids to briefly show Akyros's Hidden Mark portrait on - same
  // explicit-timer pattern as the flags above.
  let akyrosHiddenCharacterIds = new Set();
  let akyrosHiddenClearTimer = null;
  // Character ids to briefly show Zerathys's Charge Up portrait on - same
  // explicit-timer pattern as the flags above.
  let zerathysChargeCharacterIds = new Set();
  let zerathysChargeClearTimer = null;
  // Character ids to briefly show Tharox's Titan Toss portrait on - same
  // explicit-timer pattern as the flags above.
  let tharoxTossCharacterIds = new Set();
  let tharoxTossClearTimer = null;
  // Character ids to briefly show Athena's Curse Strike portrait on - same
  // explicit-timer pattern as the flags above.
  let athenaCurseCharacterIds = new Set();
  let athenaCurseClearTimer = null;
  // Character ids to briefly show Velorya's strike portrait on - covers both
  // Lunar Strike and Moonstep, her two attacks - same explicit-timer pattern
  // as the flags above.
  let veloryaStrikeCharacterIds = new Set();
  let veloryaStrikeClearTimer = null;
  // Guards against scheduling more than one bot-move timeout for the same
  // character across repeated renders while its turn is still pending.
  let botMoveScheduledFor = null;

  function markHitFromResult(result) {
    if (!result) return;
    if (result.amountDealt > 0 && result.targetCharacterId) {
      flashCharacterIds.add(result.targetCharacterId);
    }
    if (result.mirrorResult) markHitFromResult(result.mirrorResult);
  }
  // turnTimer: { characterId, intervalId, remaining } - a single 20s budget
  // for the WHOLE turn (choosing an action, choosing a target, cancelling
  // and repicking any number of times). Started once when the character's
  // turn begins and never reset by arming/cancelling - only cleared when
  // the turn actually resolves (or expires and auto-picks for them).
  let turnTimer = null;
  // ballTimer: covers the window where the holder can drag/tap the Jester
  // Ball to Return/Pass it, before it auto-explodes (Take) on timeout.
  let ballTimer = null;
  // Whether the holder has tapped the ball icon (touch fallback for drag) -
  // gates card taps so an unrelated tap can't accidentally resolve the ball.
  // Native mouse drag-and-drop works regardless of this flag.
  let ballTapArmed = false;

  function clearTurnTimer() {
    if (turnTimer) {
      clearInterval(turnTimer.intervalId);
      turnTimer = null;
      stopTickLoop();
    }
  }

  function clearBallTimer() {
    if (ballTimer) {
      clearInterval(ballTimer.intervalId);
      ballTimer = null;
      stopTickLoop();
    }
  }

  function startBallTimer(holderId) {
    clearBallTimer();
    startTickLoop();
    ballTimer = { holderId, remaining: ACTION_TIMER_SECONDS, intervalId: null };
    ballTimer.intervalId = setInterval(() => {
      ballTimer.remaining -= 1;
      const el = document.getElementById('ball-timer-count');
      if (el) el.textContent = String(ballTimer.remaining);
      if (ballTimer.remaining <= 0) {
        clearBallTimer();
        explodeBallAsTake(holderId);
      }
    }, 1000);
  }

  // Starts the single per-turn countdown if one isn't already running for
  // this character - arming an action, cancelling, or repicking never
  // restarts it, so a player can never stretch a turn past 20s total.
  function startTurnTimer(characterId) {
    if (turnTimer && turnTimer.characterId === characterId) return;
    clearTurnTimer();
    startTickLoop();
    turnTimer = { characterId, remaining: ACTION_TIMER_SECONDS, intervalId: null };
    turnTimer.intervalId = setInterval(() => {
      turnTimer.remaining -= 1;
      const actionEl = document.getElementById('action-timer-count');
      if (actionEl) actionEl.textContent = String(turnTimer.remaining);
      const targetEl = document.getElementById('target-timer-count');
      if (targetEl) targetEl.textContent = String(turnTimer.remaining);
      if (turnTimer.remaining <= 0) {
        clearTurnTimer();
        const armedAtExpiry = armedAction;
        armedAction = null;
        if (armedAtExpiry) {
          autoPickRandomTargetFor(armedAtExpiry);
        } else {
          autoPickRandomMove(characterId);
        }
      }
    }, 1000);
  }

  function autoPickRandomTargetFor(action) {
    const validTargets = Object.keys(game.characters).filter((tid) => {
      if (action.targetFilter) return action.targetFilter(tid);
      return isValidTarget(game, action.characterId, action.actionId, tid);
    });
    if (validTargets.length === 0) {
      render();
      return;
    }
    const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
    action.onPicked(targetId);
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
      clearTurnTimer();
      if (!victorySoundPlayed) {
        victorySoundPlayed = true;
        if (game.winnerPlayerId) playVictory();
        startMenuMusic();
      }
      container.appendChild(renderGameOver());
      return;
    }

    const activeCharId = getActingCharacterId();

    const wrap = document.createElement('div');
    wrap.className = 'dashboard';
    wrap.appendChild(renderTopBar());
    wrap.appendChild(renderBoard(activeCharId));
    flashCharacterIds = new Set(); // consumed for this render only
    divineLightCharacterIds = new Set(); // consumed for this render only
    reviveCharacterIds = new Set(); // consumed for this render only
    shakeCharacterIds = new Set(); // consumed for this render only
    clawCharacterIds = new Set(); // consumed for this render only
    clawCounts = new Map(); // consumed for this render only
    dodgeCharacterIds = new Set(); // consumed for this render only
    smokeCharacterIds = new Set(); // consumed for this render only
    // laughingCharacterIds is NOT reset here - it clears itself via its own
    // timer (see setLaughing below) so it stays visible for a fixed
    // duration instead of vanishing on whatever render happens to come next.
    wrap.appendChild(renderActionPanel(activeCharId));
    const logPanelEl = renderLogPanel(game);
    wrap.appendChild(logPanelEl);
    container.appendChild(wrap);
    // Must run after the panel is actually attached to the live document -
    // scrollHeight is unreliable on a detached element, which is why
    // auto-scroll wasn't working before.
    logPanelEl.scrollTop = logPanelEl.scrollHeight;
  }

  function renderGameOver() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard game-over-screen';

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

    const logHeadingRow = document.createElement('div');
    logHeadingRow.style.display = 'flex';
    logHeadingRow.style.alignItems = 'center';
    logHeadingRow.style.justifyContent = 'space-between';
    logHeadingRow.style.margin = '0 0 8px';
    const logHeading = document.createElement('h3');
    logHeading.textContent = 'Full Match Log';
    logHeading.style.color = 'var(--gold)';
    logHeadingRow.appendChild(logHeading);
    const logButtons = document.createElement('div');
    logButtons.style.display = 'flex';
    logButtons.style.gap = '8px';
    const copyLogBtn = document.createElement('button');
    copyLogBtn.className = 'btn btn-small';
    copyLogBtn.textContent = 'Copy Log';
    copyLogBtn.onclick = () => {
      playUiClick();
      copyTextToClipboard(copyLogBtn, formatLogAsText(game));
    };
    logButtons.appendChild(copyLogBtn);
    const copyConsoleBtn = document.createElement('button');
    copyConsoleBtn.className = 'btn btn-small';
    copyConsoleBtn.textContent = 'Copy Console Log';
    copyConsoleBtn.onclick = () => {
      playUiClick();
      copyTextToClipboard(copyConsoleBtn, getConsoleLogText());
    };
    logButtons.appendChild(copyConsoleBtn);
    logHeadingRow.appendChild(logButtons);
    wrap.appendChild(logHeadingRow);
    const logPanel = renderLogPanel(game);
    logPanel.style.maxHeight = '400px';
    wrap.appendChild(logPanel);

    return wrap;
  }

  // Copies arbitrary text (match log or captured console output) to the
  // clipboard so it can be pasted elsewhere (e.g. for reporting a
  // suspected bug). Briefly flips the button label to confirm
  // success/failure rather than relying on a separate toast.
  function copyTextToClipboard(btn, text) {
    const showResult = (label) => {
      const original = btn.textContent;
      btn.textContent = label;
      setTimeout(() => { btn.textContent = original; }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showResult('Copied!'),
        () => showResult('Copy failed')
      );
    } else {
      // Fallback for contexts without the async Clipboard API (e.g. plain
      // http:// local file access): a temporary offscreen textarea + the
      // legacy execCommand copy path.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showResult('Copied!');
      } catch {
        showResult('Copy failed');
      }
      document.body.removeChild(textarea);
    }
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

    const rulesBtn = document.createElement('button');
    rulesBtn.className = 'btn btn-small';
    rulesBtn.textContent = 'How to Play';
    rulesBtn.onclick = () => {
      playUiClick();
      renderRulesModal(document.body);
    };
    actions.appendChild(rulesBtn);

    const copyLogBtn = document.createElement('button');
    copyLogBtn.className = 'btn btn-small';
    copyLogBtn.textContent = 'Copy Log';
    copyLogBtn.onclick = () => {
      playUiClick();
      copyTextToClipboard(copyLogBtn, formatLogAsText(game));
    };
    actions.appendChild(copyLogBtn);

    const copyConsoleBtn = document.createElement('button');
    copyConsoleBtn.className = 'btn btn-small';
    copyConsoleBtn.textContent = 'Copy Console Log';
    copyConsoleBtn.onclick = () => {
      playUiClick();
      copyTextToClipboard(copyConsoleBtn, getConsoleLogText());
    };
    actions.appendChild(copyConsoleBtn);

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'btn btn-small';
    fullscreenBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    fullscreenBtn.onclick = () => {
      playUiClick();
      toggleFullscreen();
    };
    actions.appendChild(fullscreenBtn);

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-small';
    undoBtn.textContent = 'Undo Last Action';
    undoBtn.disabled = !undoSnapshot;
    undoBtn.onclick = () => {
      if (!undoSnapshot) return;
      playUiClick();
      clearTurnTimer();
      Object.assign(game, undoSnapshot);
      undoSnapshot = null;
      armedAction = null;
      ballTapArmed = false;
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
          { label: 'Restart', primary: true, onClick: () => { clearTurnTimer(); onRestart(); } },
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
    const ballHolderId = jesterBallHolderCharacterId(game);
    const activePlayerId = currentPlayer(game).id;

    // The ball is resolvable right now if its holder is the active character
    // and hasn't acted yet this turn - drives drop-target highlighting on
    // every card and makes the holder's own ball icon grabbable.
    const ballResolvable = ballHolderId
      && ballHolderId === activeCharId
      && !hasCharacterActedThisTurn(game, ballHolderId);

    game.players.forEach((player, playerIndex) => {
      const group = document.createElement('div');
      const sizeClass = player.characterIds.length === 2 ? ' team-size-2' : '';
      group.className = 'team-group' + sizeClass + (player.id === activePlayerId ? ' active-team' : '');

      const header = document.createElement('div');
      header.className = 'team-header ' + PLAYER_COLOR_CLASSES[playerIndex % PLAYER_COLOR_CLASSES.length];
      header.textContent = player.name + (player.id === activePlayerId ? ' (current turn)' : '');
      group.appendChild(header);

      const cardsRow = document.createElement('div');
      cardsRow.className = 'team-cards';

      player.characterIds.forEach((charId) => {
        const character = game.characters[charId];
        const isTargetable = !!armedAction && isLegalTarget(character.id);
        const isBallDropTarget = ballResolvable && isValidBallDropTarget(ballHolderId, character.id);
        const isOwnBallCard = ballResolvable && character.id === ballHolderId;
        const card = renderCharacterCard(character, {
          isActing: character.id === activeCharId,
          isTargetable,
          isCursed: character.id === curseId,
          isFrozenVisual: character.id === frozenId,
          isRevealedMarked: markedIds.has(character.id),
          isHit: flashCharacterIds.has(character.id),
          isDivineLight: divineLightCharacterIds.has(character.id),
          isRevived: reviveCharacterIds.has(character.id),
          isShaking: shakeCharacterIds.has(character.id),
          isClawed: clawCharacterIds.has(character.id),
          clawCount: clawCounts.get(character.id),
          isDodging: dodgeCharacterIds.has(character.id),
          isSmoking: smokeCharacterIds.has(character.id),
          isLaughing: laughingCharacterIds.has(character.id),
          isAthenaHealing: athenaHealingCharacterIds.has(character.id),
          isTharoxGlory: tharoxGloryCharacterIds.has(character.id),
          isZerathysSoul: zerathysSoulCharacterIds.has(character.id),
          isAkyrosShadow: akyrosShadowCharacterIds.has(character.id),
          isChronoxTime: chronoxTimeCharacterIds.has(character.id),
          isAkyrosDodge: akyrosDodgeCharacterIds.has(character.id),
          isBoingoHardpunch: boingoHardpunchCharacterIds.has(character.id),
          isBoingoMiss: boingoMissCharacterIds.has(character.id),
          isChronoxCyclone: chronoxCycloneCharacterIds.has(character.id),
          isAkyrosHidden: akyrosHiddenCharacterIds.has(character.id),
          isZerathysCharge: zerathysChargeCharacterIds.has(character.id),
          isTharoxToss: tharoxTossCharacterIds.has(character.id),
          isAthenaCurse: athenaCurseCharacterIds.has(character.id),
          isVeloryaStrike: veloryaStrikeCharacterIds.has(character.id),
          isHoldingBall: character.id === ballHolderId,
          isBallDropTarget,
          isBallClickTarget: isBallDropTarget && ballTapArmed,
          isBallArmed: isOwnBallCard && ballTapArmed,
          onBallDrop: (targetId) => handleBallDrop(ballHolderId, targetId),
          onBallIconTap: isOwnBallCard ? () => { ballTapArmed = !ballTapArmed; render(); } : undefined,
          onBallIconDragStart: isOwnBallCard ? () => {} : undefined,
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
      clearTurnTimer();
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

    if (isPCCharacter(activeCharId)) {
      clearTurnTimer();
      clearBallTimer();
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = `${def.name} (PC) is thinking...`;
      panel.appendChild(hint);
      scheduleBotMove(activeCharId);
      return panel;
    }

    if (armedAction) {
      startTurnTimer(activeCharId);
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = `Choose a target for ${armedAction.label}...`;
      panel.appendChild(hint);

      const timerEl = document.createElement('div');
      timerEl.className = 'action-timer';
      timerEl.innerHTML = `Auto-target in <span id="target-timer-count">${turnTimer ? turnTimer.remaining : ACTION_TIMER_SECONDS}</span>s`;
      panel.appendChild(timerEl);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-small';
      cancelBtn.style.marginTop = '8px';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => {
        armedAction = null;
        render();
      };
      panel.appendChild(cancelBtn);
      return panel;
    }

    const isBallHolderPrompt = game.jesterBall && game.jesterBall.holderCharacterId === activeCharId
      && !hasCharacterActedThisTurn(game, activeCharId);

    if (isBallHolderPrompt) {
      clearTurnTimer();
      if (!ballTimer || ballTimer.holderId !== activeCharId) {
        startBallTimer(activeCharId);
      }
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = 'Holding the Jester Ball: drag/tap 💣 onto Boingo (Return) or another player (Pass) - or just pick an action below and it explodes.';
      panel.appendChild(hint);

      const timerEl = document.createElement('div');
      timerEl.className = 'action-timer';
      timerEl.innerHTML = `Auto-explode in <span id="ball-timer-count">${ballTimer ? ballTimer.remaining : ACTION_TIMER_SECONDS}</span>s`;
      panel.appendChild(timerEl);
    } else {
      clearBallTimer();
      startTurnTimer(activeCharId);
      const timerEl = document.createElement('div');
      timerEl.className = 'action-timer';
      timerEl.innerHTML = `Auto-move in <span id="action-timer-count">${turnTimer ? turnTimer.remaining : ACTION_TIMER_SECONDS}</span>s`;
      panel.appendChild(timerEl);
    }

    const legalActions = getUsableActions(character, game);

    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';
    legalActions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = action.label;
      btn.onclick = () => {
        playUiClick();
        if (isBallHolderPrompt) explodeBallAsTake(activeCharId, { skipRender: true });
        onActionChosen(activeCharId, action);
      };
      btnRow.appendChild(btn);
    });
    panel.appendChild(btnRow);
    return panel;
  }

  function isPCCharacter(characterId) {
    const character = game.characters[characterId];
    if (!character) return false;
    const player = game.players.find((p) => p.id === character.ownerId);
    return !!player?.isPC;
  }

  // Schedules a bot's move on a short delay (so PC turns are readable rather
  // than instant) - guarded so repeated renders while the delay is pending
  // don't stack up multiple timeouts for the same character.
  function scheduleBotMove(characterId) {
    if (botMoveScheduledFor === characterId) return;
    botMoveScheduledFor = characterId;
    setTimeout(() => {
      botMoveScheduledFor = null;
      runBotMove(characterId);
    }, 2200);
  }

  function runBotMove(characterId) {
    const character = game.characters[characterId];
    if (!character || character.isKO) return;
    const isBallHolder = game.jesterBall && game.jesterBall.holderCharacterId === characterId
      && !hasCharacterActedThisTurn(game, characterId);
    if (isBallHolder) {
      const move = chooseBotJesterBallMove(character, game);
      pushUndoSnapshot();
      finishJesterBall(move.choice, move.targetId);
      return;
    }
    const move = chooseBotMove(character, game);
    if (!move) {
      // No usable action at all - shouldn't normally happen since
      // getUsableActions() gates this, but fail safe rather than stall.
      markCharacterActed(game, characterId);
      render();
      return;
    }
    pushUndoSnapshot();
    // isAuto: true reuses the same "resolve fully, no armed follow-up" path
    // used for timer-expiry auto-picks - a bot's Soul Swap follow-up (etc.)
    // must also resolve on its own rather than arming a human target-click.
    runResolvedAction(characterId, move.actionId, move.targetId, true);
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
      dodgeCharacterIds.add(targetId);
      if (!game.characters[targetId].isKO) setAkyrosDodge(targetId);
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
      const rolledFlip = game.log.slice(logBefore).find((e) => e.flip)?.flip;
      if (actionId === 'cyclonePunch' && rolledFlip === 'heads' && !coinResult?.dodged) {
        shakeCharacterIds.add(targetId);
      }
      if (actionId === 'cyclonePunch' && !coinResult?.dodged && !game.characters[characterId].isKO) {
        setChronoxCyclone(characterId);
      }
      playCoin();
      playPostActionSounds(actionId, targetId, logBefore);
      return finishAction(characterId);
    }

    if (CHAOS_GAMBLE_ACTIONS.has(actionId)) {
      // Pure probability roll (33% 1-hit / 33% 3-hit / 34% miss) - no
      // moderator/defender interaction or reveal screen needed.
      const logBefore = game.log.length;
      const outcome = rollChaosGamble();
      const rpsResult = executeAction(game, characterId, actionId, targetId, outcome);
      markHitFromResult(rpsResult);
      if (outcome === 'win' && !rpsResult?.dodged) {
        shakeCharacterIds.add(targetId);
        if (!game.characters[characterId].isKO) setBoingoHardpunch(characterId);
      }
      if (outcome !== 'lose') {
        playPostActionSounds(actionId, targetId, logBefore);
      } else {
        playSound('miss');
        if (!game.characters[characterId].isKO) setBoingoMiss(characterId);
      }
      return finishAction(characterId);
    }

    if (actionId === 'soulSwap') {
      executeAction(game, characterId, 'soulSwap', targetId);
      playActionSound('soulSwap');
      setZerathysSoul(characterId);

      if (isAuto) {
        // The whole move was auto-picked (turn timer expired, or a PC bot's
        // turn) - the free follow-up must also resolve automatically,
        // otherwise it would sit armed waiting for a target click that may
        // never come. Use the same kill-securing/shield-aware target logic
        // as a normal Thunder Wrath choice rather than a plain random pick -
        // a fully random pick could waste the free hit on a shielded target
        // for zero effect when an unshielded one was available.
        const freeTargetId = chooseSoulSwapWrathTarget(game.characters[characterId], game)
          ?? pickRandomTarget(characterId, 'soulSwapWrath');
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
      if (actionId === 'divineRestore') setAthenaHealing(characterId);
      if (actionId === 'glorySmash') setTharoxGlory(characterId);
    }
    if (actionId === 'timeFreeze' && !game.characters[characterId].isKO) {
      setChronoxTime(characterId);
    }
    if (actionId === 'hiddenMark' && !game.characters[characterId].isKO) {
      setAkyrosHidden(characterId);
    }
    if (actionId === 'chargeUp' && !game.characters[characterId].isKO) {
      setZerathysCharge(characterId);
    }
    if (actionId === 'titanToss' && !game.characters[characterId].isKO) {
      setTharoxToss(characterId);
    }
    if (actionId === 'curseStrike' && !game.characters[characterId].isKO) {
      setAthenaCurse(characterId);
    }
    if ((actionId === 'lunarStrike' || actionId === 'moonstep') && !result?.dodged && !game.characters[characterId].isKO) {
      setVeloryaStrike(characterId);
    }
    if ((actionId === 'titanSmash' || actionId === 'glorySmash') && targetId && !result?.dodged && result?.amountDealt > 0) {
      shakeCharacterIds.add(targetId);
    }
    if (actionId === 'shadowExecution' && targetId && !result?.dodged && result?.amountDealt > 0) {
      shakeCharacterIds.add(targetId);
      clawCharacterIds.add(targetId);
      clawCounts.set(targetId, 3);
      if (!game.characters[characterId].isKO) setAkyrosShadow(characterId);
    }
    if (actionId === 'bloodHunt' && targetId && !result?.dodged && result?.amountDealt > 0) {
      const streak = game.characters[characterId]?.special?.streakCount || 1;
      if (streak >= 3) shakeCharacterIds.add(targetId);
      clawCharacterIds.add(targetId);
      clawCounts.set(targetId, streak);
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
    clearTurnTimer();
    const { onPicked } = armedAction;
    armedAction = null;
    onPicked(targetId);
  }

  function getActingCharacterId() {
    const acting = charactersActingThisTurn(game);
    for (const character of acting) {
      if (hasCharacterActedThisTurn(game, character.id)) continue;
      const isBallHolder = game.jesterBall && game.jesterBall.holderCharacterId === character.id;
      if (consumeSkipIfFrozen(character)) {
        game.log.push({ type: 'passive', characterId: character.id, text: `${CHARACTERS[character.id].name} is frozen and skips their turn.` });
        markCharacterActed(game, character.id);
        continue;
      }
      if (!game.turnStartFiredFor.has(character.id)) {
        game.turnStartFiredFor.add(character.id);
        beginCharacterTurn(character, game, game.log);
      }
      // A ball holder can always resolve the ball even with zero normal
      // actions available, so don't auto-skip them in that case.
      if (!isBallHolder && getUsableActions(character, game).length === 0) {
        game.log.push({ type: 'passive', characterId: character.id, text: `${CHARACTERS[character.id].name} has no valid targets and skips their turn.` });
        markCharacterActed(game, character.id);
        continue;
      }
      return character.id;
    }
    return null;
  }

  // Is targetId a valid place to drop the ball for the given holder? Boingo
  // (the original thrower) is always valid (Return); anyone else is valid
  // only if the one-time Pass hasn't been used yet.
  function isValidBallDropTarget(holderId, targetId) {
    const t = game.characters[targetId];
    if (!t || t.isKO || t.id === holderId) return false;
    if (t.id === game.jesterBall.thrownByCharacterId) return true; // Return
    // Pass only ever goes to an enemy, same as every other targeted action -
    // passing to your own teammate doesn't make sense strategically.
    const holder = game.characters[holderId];
    if (t.ownerId === holder.ownerId) return false;
    return game.jesterBall.canPass; // Pass
  }

  function handleBallDrop(holderId, targetId) {
    if (!game.jesterBall || game.jesterBall.holderCharacterId !== holderId) return;
    if (!isValidBallDropTarget(holderId, targetId)) return;
    clearBallTimer();
    ballTapArmed = false;
    pushUndoSnapshot();
    const choice = targetId === game.jesterBall.thrownByCharacterId ? 'return_' : 'pass';
    finishJesterBall(choice, targetId);
  }

  // skipRender: when the explosion is immediately followed by the holder's
  // chosen normal action (same click), that action's own render() is what
  // actually gets painted - an intermediate render() here would consume
  // and clear the one-shot smoke/shake flags before they're ever shown,
  // since the next render() resets them again before reading them.
  // Shows Boingo's laughing portrait for a fixed duration, independent of
  // how many renders happen in between (a bot's turn can start almost
  // immediately after this resolves).
  function setLaughing(characterId) {
    laughingCharacterIds.add(characterId);
    if (laughingClearTimer) clearTimeout(laughingClearTimer);
    laughingClearTimer = setTimeout(() => {
      laughingClearTimer = null;
      laughingCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Athena's healing portrait for a fixed duration - same reasoning
  // as setLaughing above.
  function setAthenaHealing(characterId) {
    athenaHealingCharacterIds.add(characterId);
    if (athenaHealingClearTimer) clearTimeout(athenaHealingClearTimer);
    athenaHealingClearTimer = setTimeout(() => {
      athenaHealingClearTimer = null;
      athenaHealingCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Tharox's Glory Smash portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setTharoxGlory(characterId) {
    tharoxGloryCharacterIds.add(characterId);
    if (tharoxGloryClearTimer) clearTimeout(tharoxGloryClearTimer);
    tharoxGloryClearTimer = setTimeout(() => {
      tharoxGloryClearTimer = null;
      tharoxGloryCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Zerathys's Soul Swap portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setZerathysSoul(characterId) {
    zerathysSoulCharacterIds.add(characterId);
    if (zerathysSoulClearTimer) clearTimeout(zerathysSoulClearTimer);
    zerathysSoulClearTimer = setTimeout(() => {
      zerathysSoulClearTimer = null;
      zerathysSoulCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Akyros's Shadow Execution portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setAkyrosShadow(characterId) {
    akyrosShadowCharacterIds.add(characterId);
    if (akyrosShadowClearTimer) clearTimeout(akyrosShadowClearTimer);
    akyrosShadowClearTimer = setTimeout(() => {
      akyrosShadowClearTimer = null;
      akyrosShadowCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Chronox's Time Freeze portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setChronoxTime(characterId) {
    chronoxTimeCharacterIds.add(characterId);
    if (chronoxTimeClearTimer) clearTimeout(chronoxTimeClearTimer);
    chronoxTimeClearTimer = setTimeout(() => {
      chronoxTimeClearTimer = null;
      chronoxTimeCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Akyros's dodge portrait for a fixed duration - same reasoning as
  // setLaughing above.
  function setAkyrosDodge(characterId) {
    akyrosDodgeCharacterIds.add(characterId);
    if (akyrosDodgeClearTimer) clearTimeout(akyrosDodgeClearTimer);
    akyrosDodgeClearTimer = setTimeout(() => {
      akyrosDodgeClearTimer = null;
      akyrosDodgeCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Boingo's hard-punch portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setBoingoHardpunch(characterId) {
    boingoHardpunchCharacterIds.add(characterId);
    if (boingoHardpunchClearTimer) clearTimeout(boingoHardpunchClearTimer);
    boingoHardpunchClearTimer = setTimeout(() => {
      boingoHardpunchClearTimer = null;
      boingoHardpunchCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Boingo's miss portrait for a fixed duration - same reasoning as
  // setLaughing above.
  function setBoingoMiss(characterId) {
    boingoMissCharacterIds.add(characterId);
    if (boingoMissClearTimer) clearTimeout(boingoMissClearTimer);
    boingoMissClearTimer = setTimeout(() => {
      boingoMissClearTimer = null;
      boingoMissCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Chronox's Cyclone Punch portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setChronoxCyclone(characterId) {
    chronoxCycloneCharacterIds.add(characterId);
    if (chronoxCycloneClearTimer) clearTimeout(chronoxCycloneClearTimer);
    chronoxCycloneClearTimer = setTimeout(() => {
      chronoxCycloneClearTimer = null;
      chronoxCycloneCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Akyros's Hidden Mark portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setAkyrosHidden(characterId) {
    akyrosHiddenCharacterIds.add(characterId);
    if (akyrosHiddenClearTimer) clearTimeout(akyrosHiddenClearTimer);
    akyrosHiddenClearTimer = setTimeout(() => {
      akyrosHiddenClearTimer = null;
      akyrosHiddenCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Zerathys's Charge Up portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setZerathysCharge(characterId) {
    zerathysChargeCharacterIds.add(characterId);
    if (zerathysChargeClearTimer) clearTimeout(zerathysChargeClearTimer);
    zerathysChargeClearTimer = setTimeout(() => {
      zerathysChargeClearTimer = null;
      zerathysChargeCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Tharox's Titan Toss portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setTharoxToss(characterId) {
    tharoxTossCharacterIds.add(characterId);
    if (tharoxTossClearTimer) clearTimeout(tharoxTossClearTimer);
    tharoxTossClearTimer = setTimeout(() => {
      tharoxTossClearTimer = null;
      tharoxTossCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Athena's Curse Strike portrait for a fixed duration - same
  // reasoning as setLaughing above.
  function setAthenaCurse(characterId) {
    athenaCurseCharacterIds.add(characterId);
    if (athenaCurseClearTimer) clearTimeout(athenaCurseClearTimer);
    athenaCurseClearTimer = setTimeout(() => {
      athenaCurseClearTimer = null;
      athenaCurseCharacterIds = new Set();
      render();
    }, 1600);
  }

  // Shows Velorya's strike portrait (Lunar Strike or Moonstep) for a fixed
  // duration - same reasoning as setLaughing above.
  function setVeloryaStrike(characterId) {
    veloryaStrikeCharacterIds.add(characterId);
    if (veloryaStrikeClearTimer) clearTimeout(veloryaStrikeClearTimer);
    veloryaStrikeClearTimer = setTimeout(() => {
      veloryaStrikeClearTimer = null;
      veloryaStrikeCharacterIds = new Set();
      render();
    }, 1600);
  }

  function explodeBallAsTake(holderId, { skipRender = false } = {}) {
    if (!game.jesterBall || game.jesterBall.holderCharacterId !== holderId) return;
    clearBallTimer();
    ballTapArmed = false;
    pushUndoSnapshot();
    finishJesterBall('take', undefined, { skipRender });
  }

  function finishJesterBall(choice, targetId, { skipRender = false } = {}) {
    const holderId = game.jesterBall.holderCharacterId;
    const thrownByCharacterId = game.jesterBall.thrownByCharacterId;
    const logBefore = game.log.length;
    const ballResult = resolveJesterBall(game, holderId, choice, targetId);
    markHitFromResult(ballResult);
    if (choice === 'pass') playSound('kick');
    else if (choice === 'take') {
      const rebirthEntry = game.log.slice(logBefore).find((e) => e.type === 'rebirth');
      if (rebirthEntry) {
        playSound('rebirth');
        reviveCharacterIds.add(rebirthEntry.targetCharacterId);
      } else {
        playSound('smash'); // the ball explodes on the holder
        smokeCharacterIds.add(holderId);
        shakeCharacterIds.add(holderId);
        const holder = game.characters[holderId];
        if (holder?.isKO && game.phase !== 'game-over') setTimeout(() => playKO(), 200);
        // The ball only ever explodes on someone ELSE - Boingo himself is
        // never the holder who Takes it - so his mischief paid off either
        // way: flash his laughing portrait.
        if (thrownByCharacterId && !game.characters[thrownByCharacterId].isKO) {
          setLaughing(thrownByCharacterId);
        }
      }
    }
    else {
      playSound('magic');
      // Return to Boingo heals him +4 - same golden self-buff glow used for
      // Divine Restore/Glory Smash, plus his laughing portrait.
      if (thrownByCharacterId && !game.characters[thrownByCharacterId].isKO) {
        divineLightCharacterIds.add(thrownByCharacterId);
        setLaughing(thrownByCharacterId);
      }
    }
    // Return/Pass consume the holder's turn action. Take does NOT - the
    // holder still gets their normal action afterward this same turn.
    if (choice !== 'take') {
      markCharacterActed(game, holderId);
    }
    if (!skipRender) render();
  }

  document.addEventListener('fullscreenchange', render);

  render();
}
