const {window} = require('vscode')
const path = require('path')
const _ = require('lodash')
const {getLineImports, parseLineImportPath, isPathPackage} = require('./utils')

function buildImportItems(plugin, exportData) {
  const {projectRoot, shouldIncludeImport} = plugin
  const activeFilepath = window.activeTextEditor.document.fileName
  const items = []

  for (const importPath of Object.keys(exportData).sort()) {
    const data = exportData[importPath]
    const absImportPath = data.isExtraImport ? importPath : path.join(projectRoot, importPath)
    if (shouldIncludeImport && !shouldIncludeImport(absImportPath, activeFilepath)) {
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
  const {label: exportName, isExtraImport} = importSelection
  const isPackageImport = !importSelection.description
  const importPath = importSelection.description || exportName
  const editor = window.activeTextEditor

  const lines = editor.document.getText().split('\n')
  
  const linePosition = getLinePosition(plugin, importPath, isExtraImport, lines)
  if (isPackageImport && !linePosition.isFirstImportLine && !linePosition.lineIndexModifier) {
    window.showErrorMessage('Can\'t import entire package when parts of the package are already being imported.')
    return
  }
  const lineImports = getNewLineImports(lines, exportName, linePosition)
  if (!lineImports) return
  
  let newLine = getNewLine(plugin, importPath, lineImports)

  // Import groups

  const {lineIndexModifier} = linePosition
  // If lineIndexModifier is 0, we're adding to a pre-existing line so no need to worry about groups
  if (lineIndexModifier && plugin.importGroups) {
    const insertPosition = lineIndexModifier < 0 ? linePosition.start - 1 : linePosition.start
    const surrounding = getSurroundingImportPaths(plugin, lines, insertPosition)
    
    if (surrounding.before || surrounding.after) {
      const beforeGroup = surrounding.before ? findImportPathGroup(plugin, surrounding.before) : null
      const afterGroup = surrounding.after ? findImportPathGroup(plugin, surrounding.after) : null
      const newGroup = findImportPathGroup(plugin, importPath || exportName)

      if (surrounding.before && newGroup != beforeGroup) newLine = '\n' + newLine
      if (surrounding.after && newGroup != afterGroup) newLine += '\n'
    }
  }
  
  plugin.utils.insertLine(newLine, linePosition, lines)
}

function findImportPathGroup(plugin, importPath) {
  const importPathPrefix = plugin.utils.strUntil(importPath, '.')
  
  for (const group of plugin.importGroups) {
    if (Array.isArray(group) ? group.includes(importPathPrefix) : group(importPathPrefix)) {
      return group
    }
  }
}

function maybeParseLineImportPath(plugin, line) {
  return line.startsWith('from') || line.startsWith('import') ? parseLineImportPath(plugin, line) : null
}

function getSurroundingImportPaths(plugin, lines, insertPosition) {
  let before
  
  for (let i = insertPosition; i > -1; i--) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#') || line.startsWith('"""')) continue // don't break in case comment is in the middle of a group
    before = maybeParseLineImportPath(plugin, line)
    if (before) break
  }

  return {
    before,
    after: maybeParseLineImportPath(plugin, lines[insertPosition + 1].trim())
  }
}

/**
 * Determine which line number should get the import. This could be merged into that line if they have the same path
 * (resulting in lineIndexModifier = 0), or inserted as an entirely new import line before or after
 * (lineIndexModifier = -1 or 1)
 **/
function getLinePosition(plugin, importPath, isExtraImport, lines) {
  let start
  let isMultiLine
  let isInsideParens
  const importLineData = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    if (!isMultiLine) {
      if (line.startsWith('import')) {
        const linePath = parseLineImportPath(plugin, line)
        if (linePath === importPath) return lineData // Return start/end data immediately if matching path found
        importLineData[linePath] = {start: i}
        continue
      }

      const isImportStart = line.startsWith('from')
      if (!isImportStart && start == null) {
        if (!line.startsWith('#')) break // no longer in import section
        continue
      }

      if (isImportStart) start = i
    }

    if (isInsideParens) {
      if (!line.endsWith(')')) continue
    } else if (line.includes(' import (')) {
      if (!line.endsWith(')')) {
        isMultiLine = true
        isInsideParens = true
        continue
      }
    } else if (line.endsWith('\\')) {
      isMultiLine = true
      continue
    }

    isMultiLine = false
    isInsideParens = false

    const linePath = parseLineImportPath(plugin, lines[start])
    const lineData = {start, end: i}
    if (linePath === importPath) return lineData // Return start/end data immediately if matching path found
    importLineData[linePath] = lineData
    start = null
  }

  const paths = Reflect.ownKeys(importLineData)

  // If this is the first import, find the first non-comment line.
  if (!paths.length) {
    // If there is no line that doesn't start with a comment, we need lineIndexModifier to be 1.
    // It will get set to -1 if a line without a comment is encountered (see end of for-loop)
    let lineIndexModifier = 1
    let isMultilineComment
    let lineIndex
    
    for (let i = 0; i < lines.length; i++) {
      // Don't use lineIndex as incrementor in for-loop declaration because it will get incremented one time too many
      lineIndex = i
      const line = lines[i].trim()
      if (isMultilineComment) {
        if (line.endsWith('"""')) isMultilineComment = false
        continue
      }
      if (line.startsWith('"""')) {
        isMultilineComment = true
        continue
      }
      if (line.startsWith('#')) continue
      lineIndexModifier = -1
      break
    }

    return { start: lineIndex, lineIndexModifier, isFirstImportLine: true }
  }

  const importPos = plugin.importOrderMap[importPath]
  const importIsAbsolute = !importPath.startsWith('.')
  
  for (let i = 0; i < paths.length; i++) {
    const linePath = paths[i]

    // TODO: find import group for every one ????
    
    // plugin.importOrder check
    const lineImportPos = plugin.importOrderMap[linePath]
    if (importPos != null && (!lineImportPos || importPos < lineImportPos )) {
      return { start: importLineData[linePath].start, lineIndexModifier: -1 }
    } else if (lineImportPos != null) {
      continue
    }

    // Package check
    const lineIsPackage = isPathPackage(plugin, linePath)

    if (isExtraImport && (!lineIsPackage || importPath < linePath)) {
      return {start: importLineData[linePath].start, lineIndexModifier: -1}
    } else if (lineIsPackage) {
      continue
    }

    // Absolute path check
    const lineIsAbsolute = !linePath.startsWith('.')
    if (importIsAbsolute && (!lineIsAbsolute || importPath < linePath)) {
      return {start: importLineData[linePath].start, lineIndexModifier: -1}
    } else if (lineIsAbsolute) {
      continue
    }
  }

  // Since we didn't find a line to sort the new import before, it will go after the last import
  const lastLineData = importLineData[_.last(paths)]
  return {
    start: lastLineData.end || lastLineData.start,
    lineIndexModifier: 1
  }
}

function getNewLineImports(lines, exportName, linePosition) {
  const {start, end, lineIndexModifier, isFirstImportLine} = linePosition

  if (lineIndexModifier || isFirstImportLine) return [exportName]

  const lineImports = getLineImports(lines, start, end)
  if (lineImports.includes(exportName)) return
  
  lineImports.push(exportName)
  return lineImports
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
      if (isLast) fullText += line
    } else {
      fullText += line + lineEndChar + '\n' + tabChar
      line = newText.trim()
    }
  })

  if (useParens) fullText += ')'
  return fullText
}

module.exports = {
  buildImportItems,
  insertImport,
}
