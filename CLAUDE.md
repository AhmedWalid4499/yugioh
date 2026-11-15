# Notes for Claude

## Working agreement with the owner
- **Merge your own pull requests** as soon as their CI ("Mac app" workflow) is green — don't ask first. The owner asked for this explicitly.
- After merging, confirm the GitHub Release for the new version published (both `.dmg` files, `duel-vault-web.zip`, `update.json`) and tell the owner how to update.

## Releasing
- Bump the version in **both** `package.json` and `js/version.js`, and add a `## <version>` section to `CHANGELOG.md` (it becomes the in-app "What's new").
- Only bump `duelVault.minAppVersion` when `desktop/` or Electron changes; otherwise installed apps update with one click.

## Tests
```bash
npm test
```
```bash
npm run build:web && xvfb-run -a npm run test:desktop
```
In this sandbox, run the browser tests with `PW_CHROMIUM=/opt/pw-browsers/chromium`.
