<p align="center"><img src="https://raw.githubusercontent.com/ericbiewener/vscode-vandelay-py/master/logo.png" width="128" height="112" align="center" /></p>
<h1 align="center">Vandelay Python</h1>

<p align="center">
  <strong>Official Python plugin for the <a href="https://github.com/ericbiewener/vscode-vandelay">Vandelay VS Code extension</a></strong>.
  <br />
  An official <a href="https://github.com/ericbiewener/vscode-vandelay-js">JavaScript</a> plugin also exists.
</p>

<br />
<p align="center">
<img src="https://raw.githubusercontent.com/ericbiewener/vscode-vandelay-py/master/artwork/animation.gif" width="757" height="425" align="center" />
</p>
<br />

## Table of Contents
- [Overview](#overview)
- [Commands](#commands)
- [Importing from System & 3rd-Party Packages](#importing-from-system--3rd-party-packages)
- [How to Use](#how-to-use)
- [Configuration](#configuration-vandelay-pyjs)
- [Multi-Root Workspace](#multi-root-workspace)
- [Example Configuration File](#example-configuration-file)
- [Settings](#settings)

## Overview
<a href="https://www.youtube.com/watch?v=W4AN8Eb2LL0&t=2m10s" target="_blank"><img src="https://raw.githubusercontent.com/ericbiewener/vscode-vandelay/master/artwork/video.jpg" alt="He's an importer exporter" width="240" align="right" /></a>
Importing code is annoying and the current VS Code tooling around it isn't good enough.
This plugin keeps track of all available imports and allows you to quickly import them following
whatever style guide your project requires for how import statements get written (see
[Configuration](#configuration-vandelay-pyjs)). Multi-root workspaces are supported ([documentation](#multi-root-workspace)).

## Commands
The following commands are available from the Command Palette. Feel free to set your own keyboard shortcuts.

### Cache Project Exports
Caches all project exports in all languages that have a Vandelay configuration file (see 
[How to Use](#how to use)). Vandelay will automatically run this command the first time it
initializes for a given project, and the plugin will watch for file changes (including branch
switching, file deletion, etc) in order to update its cache of available imports. But you may need
to manually run this command if files are changed while VS Code is not running.

### Import
Select an import from your project.

### Import active word
A shortcut to automatically import the word under the carat. If more than one import matching the
active word are found, you'll be asked to choose.

## Importing from System & 3rd-Party Packages
Rather than try to do any kind of wizardry like hooking into your virtual environment, Vandelay JS
simply tracks the ones you use. This means you'll need to write the import statement yourself the
very first time you use an import from an external package, but the plugin will remember it after
that and make it available for automatic importing.

## How to Use
Vandelay relies on JavaScript configuration files, not simply JSON. As the below configuration
options demonstrate, this allows the plugin to be fully customized to your project's needs.

## Configuration (vandelay-py.js)
You must create a file named `vandelay-py.js` at the root of your project. If using a multi-root
workspace, see [those instructions](#multi-root-workspace).

#### *Any time you make changes to this file, you must reload the window.*

Along with providing configuration options, the presence of this file tells the plugin that it
should track your project's Python imports. The lack of a `vandelay-py.js` file in a given
project will simply cause the plugin not to run.

The configuration file must be written in JavaScript and export an object (`module.exports = { ...
}` syntax) containing the desired configuration options. This file may be as simple as something like:

```js
const path = require('path')
module.exports = {
  includePaths: [path.join(__dirname, 'src')]
}
```

See [this sample configuration file](#example-configuration-file) for a more complex example.

### `includePaths: Array<string>`
An array of filepaths that Vandelay should watch for exports. This is the only required configuration option.

### `excludePatterns: Array<string | RegExp>`
An array of glob patterns and regular expressions that match filepaths which should be excluded from caching.

### `importGroups: Array<Array<string>>`
Vandelay will automatically sort import statements so package imports come before your project's
custom imports, and it will alphabetize them by path. This configuration option allows you establish
some custom ordering, grouping certain imports together with full line breaks if desired. Ungrouped
packages will sort before grouped ones, while ungrouped non-package imports will sort after their
grouped equivalents. For example:

```js
importGroups: [
  ['django', 'rest_framework'],
  ['src9', 'src1'],
]
```

The above configuration will result in something like:

```py
import os # ungrouped package import sorts before grouped

from django.shortcuts import get_object_or_404
from rest_framework.response import Response

import src9
import src1

import src3 # ungrouped non-package import sorts after grouped
```

### `maxImportLineLength: number`
Defaults to 100. Used to determine when to write multiline import statements.

### `processImportPath: (importPath: string) => string`
When inserting a new import, this setting allows you to modify the import path that gets written to
the file. Useful if you have customized the locations that Python will look for imports.

* `importPath`: Proposed import path (e.g. `django.shortcuts`)

```js
processImportPath: importPath => (
  importPath.startsWith('my_packages.foo')
    ? importPath.slice('my_packages.'.length)
    : importPath
)
```

### `shouldIncludeImport: (absImportPath: string, activeFilepath: string) => boolean`
May be used to exclude certain imports from the list of options.

* `absImportPath`: absolute path of the import file
* `activeFilepath`: absolute path to the active file open in your editor

```js
shouldIncludeImport: (absImportPath, activeFilepath) => (
  absImportPath.includes('__fixtures__') && !activeFilepath.endsWith('.test.py')
)
```

## Multi-Root Workspace
You must add a `.vandelay` directory to your workspace that contains a file named `vandelay-py.js`.
Along with the above configuration options, you must also provide a `projectRoot` string that
specifies the absolute path to the directory that should be considered the overall root of your
project. This will be used for determining relative paths (these paths may always be adjusted via
the `processImportPath` configuration option described above.

## Example Configuration File
```js
const path = require('path')

const src1 = path.join(__dirname, 'src1')
const src2 = path.join(__dirname, 'src2')

module.exports = {
  includePaths: [src1, src2, src3],
  excludePatterns: [
    "**/*.test.*",
    '**/migrations/**/*.*',
    '**/management/commands/**/*.*',
    /.*\/config\/.*/,
  ],
  importGroups: [
    ['django', 'rest_framework'],
    ['src9', 'src1'],
  ],
  maxImportLineLength: 120,
  processImportPath: importPath => (
    importPath.startsWith('my_packages.foo')
      ? importPath.slice('my_packages.'.length)
      : importPath
  ),
  shouldIncludeImport: (absImportPath, activeFilepath) => (
    absImportPath.includes('__fixtures__') && !activeFilepath.endsWith('.test.py')
  )
}
```

## Settings
Vandelay has one setting that may be specified in your VS Code user settings:

### `autoImportSingleResult: boolean`
Defaults to `true`. When the `Import active word` command is used, the import will be automatically
written to the file if only a single result is found.
