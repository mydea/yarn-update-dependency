const glob = require('glob');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const lockfile = require('@yarnpkg/lockfile');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

function readPackageJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function yarnUpdateDependency() {
  let [package, version, noYarn] = process.argv.slice(2);

  console.log(`Updating ${package} to version ${version}...`);

  if (!package || !version) {
    throw new Error('You have to specify a package & version to update, e.g. "yu my-package 0.2.0"');
  }

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
      console.log(chalk.green(`✔ Updated version in ${filePath}`));
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
      console.log(chalk.green(`✔ Removed entry ${lockedPackage} from yarn.lock`));
    }
  });

  let newYarnFileContent = lockfile.stringify(yarnLockEntries);
  fs.writeFileSync('./yarn.lock', newYarnFileContent, 'utf-8');

  // Run `yarn`
  if(noYarn)  {
    console.log('');
    console.log(chalk.green('Done! Please run `yarn` to update your dependencies.'));
    return;
  }

  console.log('');
  console.log('Now running `yarn` to install new dependency...');

  await exec('yarn install');

  console.log('');
  console.log(chalk.green('Done!'));
}

module.exports = async function() {
  try {
    await yarnUpdateDependency();
  } catch(error) {
    console.log(chalk.red(error));
  }
};