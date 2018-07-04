const {window} = require('vscode')
const path = require('path')
const _ = require('lodash')
const {getLineImports, parseLineImportPath, isPathPackage} = require('./utils')
const {parseImports, getLastInitialComment} = require('./regex')

function buildImportItems(plugin, exportData) {
  const {projectRoot, shouldIncludeImport} = plugin
  const activeFilepath = window.activeTextEditor.document.fileName
  const items = []

  for (const importPath of Object.keys(exportData).sort()) {
    const data = exportData[importPath]
    const absImportPath = data.isExtraImport
      ? importPath
      : path.join(projectRoot, importPath)
    if (
      shouldIncludeImport &&
      !shouldIncludeImport(absImportPath, activeFilepath)
    ) {
      continue
    }

    let dotPath
    if (data.isExtraImport) {
      dotPath = importPath
    } else {
      dotPath = plugin.utils.removeExt(importPath).replace(/\//g, '.')
      if (plugin.processImportPath) dotPath = plugin.processImportPath(dotPath)
    }

    if (data.importEntirePackage) {
      items.push({
        label: importPath,
        isExtraImport: data.isExtraImport
      })
    }

    if (!data.exports) continue

    for (const exportName of data.exports) {
      items.push({
        label: exportName,
        description: dotPath,
        isExtraImport: data.isExtraImport
      })
    }
  }

  return items
}

function insertImport(plugin, importSelection) {
  const {label: exportName, isExtraImport} = importSelection
  const isPackageImport = !importSelection.description
  const importPath = importSelection.description || exportName
  const editor = window.activeTextEditor

  const fileText = editor.document.getText()
  const imports = parseImports(fileText)
  const importPosition = getImportPosition(
    plugin,
    importPath,
    isExtraImport,
    imports,
    fileText
  )

  if (
    isPackageImport &&
    !importPosition.isFirstImport &&
    !importPosition.indexModifier
  ) {
    window.showErrorMessage(
      'Can\'t import entire package when parts of the package are already being imported.'
    )
    return
  }

  const lineImports = getNewLineImports(importPosition, exportName)
  if (!lineImports) return

  let newLine = getNewLine(plugin, importPath, lineImports)

  // Import groups

  const {indexModifier} = importPosition
  // If indexModifier is 0, we're adding to a pre-existing line so no need to worry about groups
  if (indexModifier && plugin.importGroups) {
    const surrounding = getSurroundingImportPaths(plugin, imports, importPosition)

    if (surrounding.before || surrounding.after) {
      const beforeGroup = surrounding.before
        ? findImportPathGroup(plugin, surrounding.before.path)
        : null
      const afterGroup = surrounding.after
        ? findImportPathGroup(plugin, surrounding.after.path)
        : null
      const newGroup = findImportPathGroup(plugin, importPath || exportName)

      if (surrounding.before && newGroup != beforeGroup)
        newLine = '\n' + newLine
      if (surrounding.after && newGroup != afterGroup) newLine += '\n'
    }
  }

  plugin.utils.insertLine(newLine, importPosition)
}

function findImportPathGroup(plugin, importPath) {
  const importPathPrefix = plugin.utils.strUntil(importPath, '.')

  for (const group of plugin.importGroups) {
    if (group.includes(importPathPrefix)) {
      return group
    }
  }
}

function getSurroundingImportPaths(plugin, imports, importPosition) {
  const {match, indexModifier} = importPosition
  const matchIndex = imports.indexOf(match) + indexModifier
  const before = imports[matchIndex]
  const after = imports[matchIndex + 1]
  const lineBreakExists = before.end !== after.start

  // If a line break exists, then either before or after should be null depending on whether
  // the import is being inserted directly after `before` or directly before `after`
  return {
    before: lineBreakExists && indexModifier < 0 ? null : before,
    after: lineBreakExists && indexModifier > 0 ? null : after,
  }
}

/**
 * Determine which line number should get the import. This could be merged into that line if they have the same path
 * (resulting in indexModifier = 0), or inserted as an entirely new import line before or after
 * (indexModifier = -1 or 1)
 **/
function getImportPosition(plugin, importPath, isExtraImport, imports, text) {
  // If no imports, find first non-comment line
  if (!imports.length) {
    return {
      match: getLastInitialComment(text),
      indexModifier: 1,
      isFirstImport: true
    }
  }

  // Imports exist, find correct sort order

  const importPos = plugin.importOrderMap[importPath]
  const importIsAbsolute = !importPath.startsWith('.')

  // First look for an exact match. This is done outside the main sorting loop because we don't care
  // where the exact match is located if it exists.
  const exactMatch = imports.find(i => i.path === importPath)
  if (exactMatch) {
    return {
      match: exactMatch,
      indexModifier: 0
    }
  }

  for (const importData of imports) {
    // plugin.importOrder check
    const lineImportPos = plugin.importOrderMap[importData.path]
    if (importPos != null && (!lineImportPos || importPos < lineImportPos)) {
      return {
        match: importData,
        indexModifier: -1
      }
    } else if (lineImportPos != null) {
      continue
    }

    // Package check
    const lineIsPackage = isPathPackage(plugin, importData.path)

    if (isExtraImport && (!lineIsPackage || importPath < importData.path)) {
      return {
        match: importData,
        indexModifier: -1
      }
    } else if (lineIsPackage) {
      continue
    }

    // Absolute path check
    const lineIsAbsolute = !importData.path.startsWith('.')
    if (importIsAbsolute && (!lineIsAbsolute || importPath < importData.path)) {
      return {
        match: importData,
        indexModifier: -1
      }
    } else if (lineIsAbsolute) {
      continue
    }
  }

  // Since we didn't find a line to sort the new import before, it will go after the last import
  return {
    match: _.last(imports),
    indexModifier: 1
  }
}

function getNewLineImports(importPosition, exportName) {
  const {match, indexModifier} = importPosition

  if (indexModifier) return [exportName]
  if (match.imports.includes(exportName)) return
  return [...match.imports, exportName]
}

function getNewLine(plugin, importPath, imports) {
  const {maxImportLineLength, multilineImportParentheses: useParens} = plugin

  imports.sort()

  const newLineStart = 'from ' + importPath + ' import '
  const newLineEnd = imports.join(', ')

  const tabChar = plugin.utils.getTabChar()
  const newLineLength = newLineStart.length + newLineEnd.length

  if (newLineLength <= maxImportLineLength) {
    return newLineStart + newLineEnd
  }

  let line = newLineStart
  if (useParens) line += '('
  let fullText = ''
  const lineEndChar = useParens ? '' : ' \\'

  imports.forEach((name, i) => {
    const isLast = i === imports.length - 1

    let newText = (i > 0 ? ' ' : '') + name
    if (!isLast) newText += ','

    let newLength = line.length + newText.length
    if (useParens && isLast) newLength++ // for closing parenthesis
    if (!useParens && !isLast) newLength += 2 // for final ' \'

    if (newLength < maxImportLineLength) {
      line += newText
    } else {
      fullText += line + lineEndChar + '\n' + tabChar
      line = newText.trim()
    }

    if (isLast) fullText += line
  })

  if (useParens) fullText += ')'
  return fullText
}

module.exports = {
  buildImportItems,
  insertImport
}
