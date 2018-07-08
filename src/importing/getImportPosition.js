const _ = require('lodash')
const { commentRegex } = require('../regex')
const { isPathPackage } = require('../utils')

/**
 * Determine which line number should get the import. This could be merged into that line
 * if they have the same path (resulting in lineIndexModifier = 0), or inserted as an entirely
 * new import line before or after (lineIndexModifier = -1 or 1)
 **/

function getImportPosition(plugin, importPath, isExtraImport, imports, text) {
  // If no imports, find first non-comment line
  if (!imports.length) {
    return {
      match: plugin.utils.getLastInitialComment(text, commentRegex),
      indexModifier: 1,
      isFirstImport: true,
    }
  }

  // Imports exist, find correct sort order

  // First look for an exact match. This is done outside the main sorting loop because we don't care
  // where the exact match is located if it exists.
  const exactMatch = imports.find(i => i.path === importPath)
  if (exactMatch) {
    return { match: exactMatch, indexModifier: 0 }
  }

  const importPos = plugin.importOrderMap[importPath]
  const importIsAbsolute = !importPath.startsWith('.')

  for (const importData of imports) {
    // plugin.importOrder check
    const lineImportPos = plugin.importOrderMap[importData.path]
    if (importPos != null && (!lineImportPos || importPos < lineImportPos)) {
      return {
        match: importData,
        indexModifier: -1,
      }
    } else if (lineImportPos != null) {
      continue
    }

    // Package check
    const lineIsPackage = isPathPackage(plugin, importData.path)

    if (isExtraImport && (!lineIsPackage || importPath < importData.path)) {
      return { match: importData, indexModifier: -1 }
    } else if (lineIsPackage) {
      continue
    }

    // Absolute path check
    const lineIsAbsolute = !importData.path.startsWith('.')
    if (importIsAbsolute && (!lineIsAbsolute || importPath < importData.path)) {
      return { match: importData, indexModifier: -1 }
    } else if (lineIsAbsolute) {
      continue
    }
  }

  // Since we didn't find a line to sort the new import before, it will go after the last import
  return {
    match: _.last(imports),
    indexModifier: 1,
  }
}

module.exports = {
  getImportPosition,
}
