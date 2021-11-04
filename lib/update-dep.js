const glob = require('glob');
const fs = require('fs');
const chalk = require('chalk');
const lockfile = require('@yarnpkg/lockfile');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const program = require('commander');
const { version: packageVersion } = require('./../package');

function readPackageJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function yarnUpdateDependency() {
  let posPackage, posVersion;

  program
    .version(packageVersion, '--version')
    .usage('[package] [version] [options]')
    .arguments('[package] [version]')
    .action(function (package, version) {
      posPackage = package;
      posVersion = version;
    })
    .option('-v, --target-version <value>', 'The version to update to')
    .option('-p, --package <value>', 'The package to update')
    .option('-c, --caret', 'Update the version to ^X.X.X')
    .option('-t, --tilde', 'Update the version to ~X.X.X')
    .option('-e, --exact', 'Update the version to X.X.X')
    .option('-ny, --no-yarn', 'Do not auto-run "yarn install"')
    .parse(process.argv);

  let { targetVersion, package, caret, exact, yarn: runYarn } = program.opts();

  package = package || posPackage;
  let version = targetVersion || posVersion;

  if (typeof version === 'undefined') {
    let out = await exec(`npm show ${package} version`);
    version = out.stdout.trim();
    log(`Fetching latest version: ${version}`);
  }

  if (!version.startsWith('~') && !version.startsWith('^')) {
    let versionRangeChar = '~';
    if (exact) {
      versionRangeChar = '';
    } else if (caret) {
      versionRangeChar = '^';
    }

    version = `${versionRangeChar}${version}`;
  }

  if (!package || !version) {
    throw new Error(
      'You have to specify a package & version to update, e.g. "yu my-package 0.2.0"'
    );
  }

  log(`Updating ${package} to version ${version}...`);

  let packageJson = readPackageJson('package.json');
  let isWorkspace = !!packageJson.workspaces;

  let packageJsonFilePaths = ['package.json'];
  if (isWorkspace) {
    packageJson.workspaces.forEach((workspacePattern) => {
      let pattern = `${workspacePattern}/package.json`;
      let workspacePackageJsonFiles = glob.sync(pattern);
      packageJsonFilePaths.push(...workspacePackageJsonFiles);
    });
  }

  let hasAnyChange = false;

  // Update package.json files...
  packageJsonFilePaths.forEach((filePath) => {
    let packageJsonFile = readPackageJson(filePath);

    let dependencies = packageJsonFile.dependencies || {};
    let devDependencies = packageJsonFile.devDependencies || {};
    let peerDependencies = packageJsonFile.peerDependencies || {};

    let hasChanged = false;

    if (dependencies[package]) {
      dependencies[package] = version;
      hasChanged = true;
    }

    if (devDependencies[package]) {
      devDependencies[package] = version;
      hasChanged = true;
    }

    if (peerDependencies[package]) {
      peerDependencies[package] = version;
      hasChanged = true;
    }

    if (hasChanged) {
      let fileContent = JSON.stringify(packageJsonFile, null, 2);
      fs.writeFileSync(filePath, fileContent, 'utf-8');
      log(chalk.green(`✔ Updated version in ${filePath}`));
      hasAnyChange = true;
    }
  });

  // Update yarn.lock
  let yarnFileContent = fs.readFileSync('./yarn.lock', 'utf-8');
  let yarnLock = lockfile.parse(yarnFileContent);

  let yarnLockEntries = yarnLock;
  while (yarnLockEntries.object) {
    yarnLockEntries = yarnLockEntries.object;
  }

  let findKey = `${package}@`;
  Object.keys(yarnLockEntries).forEach((lockedPackage) => {
    if (lockedPackage.startsWith(findKey)) {
      delete yarnLockEntries[lockedPackage];
      log(chalk.green(`✔ Removed entry ${lockedPackage} from yarn.lock`));
      hasAnyChange = true;
    }
  });

  let newYarnFileContent = lockfile.stringify(yarnLockEntries);
  fs.writeFileSync('./yarn.lock', newYarnFileContent, 'utf-8');

  // Run `yarn`
  if (!hasAnyChange) {
    log('');
    log(
      chalk.yellow(
        'No update occurred - the specified dependency could not be found.'
      )
    );
    return;
  }

  if (!runYarn) {
    log('');
    log(chalk.green('Done! Please run `yarn` to update your dependencies.'));
    return;
  }

  log('');
  log('Now running `yarn` to install new dependency...');

  await exec('yarn install');

  log('');
  log(chalk.green('Done!'));
}

module.exports = async function () {
  try {
    await yarnUpdateDependency();
  } catch (error) {
    log(chalk.red(error));
  }
};

function log(str) {
  // eslint-disable-next-line no-console
  console.log(str);
}
