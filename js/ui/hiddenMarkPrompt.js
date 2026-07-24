import { showModal } from './modal.js';

// Generic "private moment" flow: shows a look-away screen, waits for a tap,
// runs the caller's private step, then shows a neutral "done" screen before
// returning to the normal dashboard.
export function runPrivateMoment({ playerName, revealPrompt, privateStep }) {
  return new Promise((resolve) => {
    showModal({
      title: 'Private Action',
      body: `Everyone else look away.<br><strong>${playerName}</strong>, tap below when ready.`,
      actions: [
        {
          label: revealPrompt || 'Reveal',
          primary: true,
          onClick: async () => {
            const result = await privateStep();
            showModal({
              title: 'Action Complete',
              body: 'The action has been recorded secretly. Tap when everyone can look back at the screen.',
              actions: [{ label: 'Continue', primary: true, onClick: () => resolve(result) }],
            });
          },
        },
      ],
    });
  });
}
