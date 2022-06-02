const chalk = require('chalk');
const program = require('commander');
const { version: packageVersion } = require('./../package');
const yarnUpdateDependency = require('./update-dependency');

async function run() {
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
    .option('-sm --silent', 'Silent output')
    .parse(process.argv);

  let {
    targetVersion,
    package,
    yarn: runYarn,
    allDependencies,
    allDevDependencies,
    silent = false,
  } = program.opts();

  package = package || posPackage;
  let version = targetVersion || posVersion;

  await yarnUpdateDependency({
    version,
    package,
    yarn: runYarn,
    allDependencies,
    allDevDependencies,
    silent,
  });
}

module.exports = async function () {
  try {
    await run();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(chalk.red(error));
  }
};
