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
    .option('-ny, --no-yarn', 'Do not auto-run "yarn install"')
    .option('-ad, --all-dependencies', 'Update all dependencies')
    .option('-adev, --all-dev-dependencies', 'Update all devDependencies')
    .parse(process.argv);

  let {
    targetVersion,
    package,
    yarn: runYarn,
    allDependencies,
    allDevDependencies,
  } = program.opts();

  package = package || posPackage;
  let version = targetVersion || posVersion;

  if (!package && !allDependencies && !allDevDependencies) {
    throw new Error(
      'You have to specify a package, --all-dependencies or --all-dev-dependencies'
    );
  }

  if (package) {
    await updateDependency(package, version);
  }

  if (allDependencies) {
    let packages = getDependencies();
    for (let package of packages) {
      log('');
      log(`Trying to update ${package}...`);
      await updateDependency(package, version, {});
    }
  }

  if (allDevDependencies) {
    let packages = getDevDependencies();
    for (let package of packages) {
      log('');
      log(`Trying to update ${package}...`);
      await updateDependency(package, version, {});
    }
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

function getDependencies() {
  let packageJsonFilePaths = getPackageJsonFiles();

  let dependencies = new Set();
  packageJsonFilePaths.forEach((filePath) => {
    let packageJsonFile = readPackageJson(filePath);

    let deps = packageJsonFile.dependencies || {};
    Object.keys(deps).forEach((dep) => {
      dependencies.add(dep);
    });
  });

  return Array.from(dependencies);
}

function getDevDependencies() {
  let packageJsonFilePaths = getPackageJsonFiles();

  let dependencies = new Set();
  packageJsonFilePaths.forEach((filePath) => {
    let packageJsonFile = readPackageJson(filePath);

    let deps = packageJsonFile.devDependencies || {};
    Object.keys(deps).forEach((dep) => {
      dependencies.add(dep);
    });
  });

  return Array.from(dependencies);
}

function updateVersion(deps, package, version) {
  // If not specifying a full version with ~ or ^, we want to keep the current symbol
  if (!version.startsWith('~') && !version.startsWith('^')) {
    let currentVersion = deps[package];
    let currentSymbol = currentVersion[0];

    if (currentSymbol === '~' || currentSymbol === '^') {
      version = `${currentSymbol}${version}`;
    }
  }

  deps[package] = version;
}

async function updateDependency(package, version) {
  if (typeof version === 'undefined') {
    let out = await exec(`npm show ${package} version`);
    version = out.stdout.trim();
    log(`Fetching latest version: ${version}`);
  }

  if (!version) {
    throw new Error(`No version found to update to for package ${package}`);
  }

  log(`Updating ${package} to version ${version}...`);

  let packageJsonFilePaths = getPackageJsonFiles();
  let hasAnyChange = false;

  // Update package.json files...
  packageJsonFilePaths.forEach((filePath) => {
    let packageJsonFile = readPackageJson(filePath);

    let dependencies = packageJsonFile.dependencies || {};
    let devDependencies = packageJsonFile.devDependencies || {};
    let peerDependencies = packageJsonFile.peerDependencies || {};

    let hasChanged = false;

    if (dependencies[package]) {
      updateVersion(dependencies, package, version);
      hasChanged = true;
    }

    if (devDependencies[package]) {
      updateVersion(devDependencies, package, version);
      hasChanged = true;
    }

    if (peerDependencies[package]) {
      updateVersion(peerDependencies, package, version);
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

function getPackageJsonFiles() {
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

  return packageJsonFilePaths;
}
