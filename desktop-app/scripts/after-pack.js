const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const productName = context.packager.appInfo.productName;
  const exePath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = join(context.packager.projectDir, 'build', 'icon.ico');
  const rceditPath = join(context.packager.projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');

  for (const path of [exePath, iconPath, rceditPath]) {
    if (!existsSync(path)) {
      throw new Error(`Arquivo necessario para aplicar o icone do desktop nao encontrado: ${path}`);
    }
  }

  execFileSync(
    rceditPath,
    [
      exePath,
      '--set-icon',
      iconPath,
      '--set-version-string',
      'FileDescription',
      productName,
      '--set-version-string',
      'ProductName',
      productName,
      '--set-version-string',
      'InternalName',
      productName,
      '--set-version-string',
      'OriginalFilename',
      `${productName}.exe`,
    ],
    { stdio: 'inherit' },
  );
};
