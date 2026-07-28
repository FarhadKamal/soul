import { createGame } from './engine/state.js';
import { renderSetupScreen } from './ui/setupScreen.js';
import { renderDashboard } from './ui/dashboardScreen.js';
import { startMenuMusic, startBattleMusic } from './engine/sound.js';

const app = document.getElementById('app');

function goToSetup() {
  startMenuMusic();
  renderSetupScreen(app, (mode, playerPicks) => {
    const game = createGame(mode, playerPicks);
    startBattleMusic();
    renderDashboard(app, game, { onRestart: goToSetup });
  });
}

goToSetup();
