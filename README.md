# Vandelay PY

Official Python plugin for the [Vandelay VS Code extension](https://github.com/ericbiewener/vscode-vandelay).

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
