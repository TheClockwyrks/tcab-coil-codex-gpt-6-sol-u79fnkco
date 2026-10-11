# Coil

Coil is a browser based neon grid serpent. Eat sparks to grow, avoid the wall and your own body, and collect the next spark before the combo timer runs out to build your multiplier.

## Run

Install dependencies with `npm ci`, then start the development server with `npm run dev`. Open the address Vite prints. Build a self contained static site with `npm run build`; serve `dist/` from any static file server, including under a subpath. Art and audio are committed in `assets/` and copied into the build.

## Controls

| Action | Keys |
| --- | --- |
| Turn | Arrow keys or W A S D |
| Confirm | Enter or Space |
| Back / pause | Escape |
| Pause / resume | P |
| Mute | M |

On a touch device, the engine shows a direction pad and menu controls. Menus also support pointer and touch selection.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` to check the source.
