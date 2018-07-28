<p align="center">
    <img src="https://raw.githubusercontent.com/ericbiewener/vscode-vandelay-py/master/artwork/logo.png" width="128" height="112" />
</p>

<p align="center">
  Official Python plugin for the <a href="https://github.com/ericbiewener/vscode-vandelay">Vandelay VS Code extension</a>.
  <br />
  An official <a href="https://github.com/ericbiewener/vscode-vandelay-js">JavaScript</a> plugin also exists.
</p>

## Configuration
INCLUDE INFO FOR VANDELAY-PY.JS CONFIG FILE

SORTING
1. shouldSortBeforeLinePath
2. importOrder config
3. Alphabetical packages
4. Alphabetical absolute paths
5. Alphabetical relative paths

`shouldSortBeforeLinePath` hook... we default packages to alphabetical sorting
 - return true to sort before, false to sort after, undefined to let our automatic sorting do further comparisons between the new importPath and the linePath. So you don't have to handle all cases.

## Misc
- Will not cache functions that begin with an underscore

# exports
classes
functions
constants
NOT _private functions
NOT non-constants
