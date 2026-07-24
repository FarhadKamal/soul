import { CHARACTERS } from '../data/characters.js';
import {
  getUsableActions, executeAction, beginCharacterTurn, currentPlayer,
  charactersActingThisTurn, hasCharacterActedThisTurn, markCharacterActed,
  endTurn, consumeSkipIfFrozen, snapshot, resolveJesterBall, isValidTarget,
} from '../engine/turnEngine.js';
import { renderCharacterCard, cursedCharacterId } from './characterCard.js';
import { renderLogPanel } from './logPanel.js';
import { showModal } from './modal.js';
import { showCoinFlipResult, askRPSOutcome } from './coinFlipView.js';
import { playActionSound, playUiClick, playKO, playVictory, playCoin, playSound } from '../engine/sound.js';

const COIN_FLIP_ACTIONS = new Set(['cyclonePunch']);
const RPS_ACTIONS = new Set(['chaosGamble']);

export function renderDashboard(container, game, { onRestart }) {
  let undoSnapshot = null;
  // armedAction: { characterId, actionId, label, targetFilter, onPicked }
  let armedAction = null;
  let jesterBallPromptShownFor = null;
  let victorySoundPlayed = false;

  function pushUndoSnapshot() {
    undoSnapshot = snapshot(game);
  }

  function render() {
    container.innerHTML = '';

    if (game.phase === 'game-over') {
      if (!victorySoundPlayed) {
        victorySoundPlayed = true;
        playVictory();
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
    wrap.appendChild(renderActionPanel(activeCharId));
    wrap.appendChild(renderLogPanel(game.log));
    container.appendChild(wrap);
  }

  function renderGameOver() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard';

    const winner = game.players.find((p) => p.id === game.winnerPlayerId);

    const banner = document.createElement('div');
    banner.className = 'game-over-banner';

    const crown = document.createElement('div');
    crown.className = 'victory-crown';
    crown.textContent = '👑';
    banner.appendChild(crown);

    const h1 = document.createElement('h1');
    h1.textContent = `${winner.name} Wins!`;
    banner.appendChild(h1);

    const sub = document.createElement('div');
    sub.className = 'victory-subtitle';
    sub.textContent = `Victorious after ${game.round} round${game.round === 1 ? '' : 's'}`;
    banner.appendChild(sub);

    const portraitRow = document.createElement('div');
    portraitRow.className = 'victory-portraits';
    winner.characterIds.forEach((charId) => {
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
          { label: 'Restart', primary: true, onClick: onRestart },
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
      const hint = document.createElement('div');
      hint.className = 'targeting-hint';
      hint.textContent = `Choose a target for ${armedAction.label}...`;
      panel.appendChild(hint);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-small';
      cancelBtn.style.marginTop = '8px';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => { armedAction = null; render(); };
      panel.appendChild(cancelBtn);
      return panel;
    }

    const legalActions = getUsableActions(character, game);
    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';
    legalActions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = action.label;
      btn.onclick = () => { playUiClick(); onActionChosen(activeCharId, action); };
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
    render();
  }

  function playPostActionSounds(actionId, targetId, logBefore) {
    const recentLog = logBefore !== undefined ? game.log.slice(logBefore) : [];
    const wasRevived = recentLog.some((e) => e.type === 'rebirth' && e.targetCharacterId === targetId);
    if (wasRevived) {
      playSound('rebirth');
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

  async function runResolvedAction(characterId, actionId, targetId) {
    if (COIN_FLIP_ACTIONS.has(actionId)) {
      // Execute first (single source of truth for the roll), then reveal it.
      const logBefore = game.log.length;
      executeAction(game, characterId, actionId, targetId);
      const rolledFlip = game.log.slice(logBefore).find((e) => e.flip)?.flip;
      playCoin();
      await showCoinFlipResult(rolledFlip || 'heads');
      playPostActionSounds(actionId, targetId, logBefore);
      return finishAction(characterId);
    }

    if (RPS_ACTIONS.has(actionId)) {
      const logBefore = game.log.length;
      const outcome = await askRPSOutcome({ attackerName: CHARACTERS[characterId].name });
      executeAction(game, characterId, actionId, targetId, outcome);
      if (outcome !== 'lose') {
        playPostActionSounds(actionId, targetId, logBefore);
      }
      return finishAction(characterId);
    }

    if (actionId === 'soulSwap') {
      executeAction(game, characterId, 'soulSwap', targetId);
      playActionSound('soulSwap');
      // Do NOT mark Zerathys as acted yet - he still owes the free Thunder
      // Wrath follow-up, and marking him now would let the turn engine
      // advance to the player's other character mid-chain.
      armAction(characterId, 'soulSwapWrath', 'Thunder Wrath (free, from Soul Swap)', (freeTargetId) => {
        pushUndoSnapshot();
        const logBefore2 = game.log.length;
        executeAction(game, characterId, 'soulSwapWrath', freeTargetId);
        playPostActionSounds('soulSwapWrath', freeTargetId, logBefore2);
        finishAction(characterId);
      });
      return;
    }

    const logBefore = game.log.length;
    executeAction(game, characterId, actionId, targetId);
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

    const canPass = game.jesterBall.canPass;
    const actionsList = [
      { label: 'Return to Boingo', onClick: () => finishJesterBall('return_') },
    ];
    if (canPass) {
      actionsList.push({
        label: 'Pass to another player',
        onClick: () => {
          armAction(holderId, '__jesterPass', 'Pass Jester Ball', (targetId) => {
            pushUndoSnapshot();
            finishJesterBall('pass', targetId);
          }, (targetId) => {
            const t = game.characters[targetId];
            // Can't pass to self, and passing back to Boingo (the original
            // thrower) is already covered by "Return" - offering it here too
            // would let Boingo end up "holding" his own ball.
            return t && !t.isKO && t.id !== holderId && t.id !== game.jesterBall.thrownByCharacterId;
          });
        },
      });
    }
    actionsList.push({ label: 'Take it (-4 hearts)', onClick: () => finishJesterBall('take') });

    setTimeout(() => {
      pushUndoSnapshot();
      showModal({
        title: `${CHARACTERS[holderId].name} is holding the Jester Ball`,
        body: 'Choose what to do with it.',
        actions: actionsList,
      });
    }, 0);
  }

  function finishJesterBall(choice, targetId) {
    const holderId = game.jesterBall.holderCharacterId;
    const logBefore = game.log.length;
    resolveJesterBall(game, holderId, choice, targetId);
    jesterBallPromptShownFor = null;
    if (choice === 'pass') playSound('kick');
    else if (choice === 'take') {
      const wasRevived = game.log.slice(logBefore).some((e) => e.type === 'rebirth' && e.targetCharacterId === holderId);
      if (wasRevived) {
        playSound('rebirth');
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
