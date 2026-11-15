/* electron-builder afterPack hook: ad-hoc sign the Mac app.
   Without an Apple Developer ID the app can't be notarised, but an ad-hoc
   signature is still required for it to run on Apple Silicon Macs. */
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  console.log('  • ad-hoc signing ' + appPath);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
