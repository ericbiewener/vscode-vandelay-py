function parseLineImportPath(plugin, line) {
  return plugin.utils.strBetween(line, ' ').trim()
}

function strAfter(str, afterChar, useRegex) {
  const index = useRegex ? str.search(afterChar) : str.indexOf(afterChar)
  return index < 0 ? str : str.slice(index + afterChar.length)
}

function isPathPackage(plugin, importPath) {
  if (importPath.startsWith('.')) return false
  const pathStart = plugin.utils.strUntil(importPath, '.')
  return !plugin.includePaths.some(p => {
    const relativePath = p.slice(plugin.projectRoot.length + 1)
    return plugin.utils.strUntil(relativePath, '/') === pathStart
  })
}

function getLineImports(lines, start, end) {
  if (end == null) {
    const hasParens = lines[start].includes(' import (')
    end = lines.slice(start).findIndex(line => hasParens ? line.endsWith(')') : !line.endsWith('\\')) + start
  }
  const singleLine = lines.slice(start, end + 1).join(' ')
  return strAfter(singleLine, 'import ')
    .replace(/[()\\]/g, '')
    .split(',')
    .map(name => name.trim())
}

module.exports = {
  strAfter,
  parseLineImportPath,
  isPathPackage,
  getLineImports
}
