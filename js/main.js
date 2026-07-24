import { createGame } from './engine/state.js';
import { renderSetupScreen } from './ui/setupScreen.js';
import { renderDashboard } from './ui/dashboardScreen.js';

const app = document.getElementById('app');

function goToSetup() {
  renderSetupScreen(app, (mode, playerPicks) => {
    const game = createGame(mode, playerPicks);
    renderDashboard(app, game, { onRestart: goToSetup });
  });
}

goToSetup();
