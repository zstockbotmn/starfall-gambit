Headless UI checks (need `playwright-core` and Google Chrome; run from a folder where playwright-core is installed, e.g. NODE_PATH=/workspace/sg-tools/node_modules).
- `node stress.js <url> [games] [width] [height]` – tap stress test (CDP touch, mouse, click-only; drift, holds, taps during the computer's delay and right after redraws). Must report 0 dropped.
- `node shot6.js <url>` – layout/feature checks + screenshots at 390x844, 375x548, 320x460, 320x568.
The game must be opened with `?debug` (the scripts add it) for the test hooks and the on-screen tap log.
