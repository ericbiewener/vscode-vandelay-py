// TODO: These should be provided to plugin extensions via the extension api
// ...those that are only getting used by JS though should just stay here...
const path = require('path')

// TODO: rename. and does it make sense to have removeDirs be a part of this? that's a very different thing
// than just removing a file extension.
function trimPath(filepath, removeDirs) {
  const ext = path.extname(filepath)
  return removeDirs
    ? path.basename(filepath, ext)
    : ext ? filepath.slice(0, -ext.length) : filepath
}

// TODO: add useRegex to vandelay-js... or just share these functions somehow?
function strBetween(str, startChar, endChar, useRegex) {
  const start = useRegex
    ? str.search(startChar)
    : str.indexOf(startChar)
  if (start < 0) return
  const substr = str.slice(start + 1)
  const end = useRegex
    ? substr.search(endChar || startChar)
    : substr.indexOf(endChar || startChar)
  if (end < 0) return
  return substr.slice(0, end).trim()
}

function parseLineImportPath(line) {
  return strBetween(line, ' ').trim()
}

// TODO: add useRegex to vandelay-js... or just share these functions somehow?
function strAfter(str, afterChar, useRegex) {
  const index = useRegex
    ? str.search(afterChar)
    : str.indexOf(afterChar)
  return index < 0 ? str : str.slice(index + afterChar.length)
}

// TODO: add useRegex to vandelay-js... or just share these functions somehow?
function strUntil(str, endChar, useRegex) {
  const index = useRegex
    ? str.search(endChar)
    : str.indexOf(endChar)
  return index < 0 ? str : str.slice(0, index)
}

function isPathPackage(plugin, importPath) {
  if (importPath.startsWith('.')) return false
  const pathStart = strUntil(importPath, '.')
  return !plugin.includePaths.some(p => {
    const relativePath = p.slice(plugin.projectRoot.length + 1)
    return strUntil(relativePath, '/') === pathStart
  })
}

module.exports = {
  strAfter,
  trimPath,
  strBetween,
  parseLineImportPath,
  strUntil,
  isPathPackage,
}
