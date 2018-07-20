const { window } = require('vscode')
const path = require('path')
const { parseImports } = require('../regex')
const { getImportPosition } = require('./getImportPosition')

function buildImportItems(plugin, exportData) {
  const { projectRoot, shouldIncludeImport } = plugin
  const activeFilepath = window.activeTextEditor.document.fileName
  const items = []

  const sortedKeys = plugin.sharedUtils.getExportDataKeysByCachedDate(exportData)
  for (const importPath of sortedKeys) {
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
        isExtraImport: data.isExtraImport,
      })
    }

    if (!data.exports) continue

    for (const exportName of data.exports) {
      items.push({
        label: exportName,
        description: dotPath,
        isExtraImport: data.isExtraImport,
      })
    }
  }

  return items
}

function insertImport(plugin, importSelection) {
  const { label: exportName, isExtraImport } = importSelection
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
      "Can't import entire package when parts of the package are already being imported."
    )
    return
  }

  const lineImports = getNewLineImports(importPosition, exportName)
  if (!lineImports) return
  let newLine = getNewLine(plugin, importPath, lineImports)

  // Import groups

  const { indexModifier } = importPosition
  // If indexModifier is 0, we're adding to a pre-existing line so no need to worry about groups
  if (indexModifier && plugin.importGroups) {
    const surrounding = getSurroundingImportPaths(
      plugin,
      imports,
      importPosition
    )

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
  const { match, indexModifier } = importPosition
  const matchIndex = imports.indexOf(match) + indexModifier
  const before = imports[matchIndex]
  const after = imports[matchIndex + 1]
  const lineBreakExists = before && after && before.end !== after.start - 1

  // If a line break exists, then either before or after should be null depending on whether
  // the import is being inserted directly after `before` or directly before `after`
  return {
    before: lineBreakExists && indexModifier < 0 ? null : before,
    after: lineBreakExists && indexModifier > 0 ? null : after,
  }
}

function getNewLineImports(importPosition, exportName) {
  const { match, indexModifier } = importPosition

  if (indexModifier) return [exportName]
  if (match.imports.includes(exportName)) return
  return [...match.imports, exportName]
}

function getNewLine(plugin, importPath, imports) {
  const { maxImportLineLength, multilineImportParentheses: useParens } = plugin

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
  insertImport,
}
