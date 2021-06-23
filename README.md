# yarn-update-dependency

Update a yarn dependency across a project/workspace & sub-dependencies.

## Usage

```bash
yu my-dependency 0.5.1          # my-dependency@~0.5.1
yu my-dependency 0.5.1 --exact  # my-dependency@0.5.1
yu my-dependency 0.5.1 --caret  # my-dependency@^0.5.1
yu my-dependency # update to current latest version
yu -h # Output all available options
```

## Installation

```bash
yarn global add yarn-update-dependency
```

## What does it do?

Running this command will:

* Update the specified package to the specified version in the `package.json`
* If run inside of a Yarn Workspace, it will also update all `package.json` in all workspace packages to the same version.
* It will then remove all entries for this package from the `yarn.lock` file
* Finally, it will run `yarn install` to update the dependencies

## Why do I need this?

This package solves two problems. 

First, it can be annoying to keep a dependency in sync in a Yarn Workspace. You'll often want to have the same dependency of a package in all workspace packages, which requires you to manually keep this in sync everywhere. With the help of `yu`, the version will be the same in all workspace packages.

Second, it can be tricky to actually update a specific version in Yarn. Just updating the version in the `package.json` and running `yarn` can lead to the package being installed multiple times - e.g. if a dependency also relies on this package.

Take this structure:

* my-app
  * my-dependency-a@1.0.0
    * my-dependency-b@^2.0.0
  * my-dependency-b@~2.0.1
  
Now you might end up with these packages installed:

* my-app
  * my-dependency-a@1.0.0
  * my-dependency-b@2.0.1
  
Now, you want to update `my-dependency-b` to 2.1.0. The version range specified in `my-dependency-a` allows for that, so you might just update this like this:

* my-app
  * my-dependency-a@1.0.0
    * my-dependency-b@^2.0.0
  * my-dependency-b@~2.1.0
  
And run `yarn` again. However, this will NOT replace the previously installed version, but actually result in this:

* my-app
  * my-dependency-a@1.0.0
  * my-dependency-b@2.0.1
  * my-dependency-b@2.1.0
  
Which is usually not what you want. The only way to really ensure that all sub-dependencies are also updated (as far as their version ranges allow), is to remove the entry from the `yarn.lock` file first - which is what this package does for you.