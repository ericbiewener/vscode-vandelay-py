// TODO: to support importing when `require` is used rather than `import from`, look for the last line that has a
// `require` statement but no indentation. That ensures you aren't dealing with a local require
const {window, Range, Position} = require('vscode')
const path = require('path')
const _ = require('lodash')
const {strBetween, trimPath, parseLineImportPath, isPathPackage, getLineImports} = require('./utils')

function buildImportItems(plugin, exportData) {
  const {projectRoot, shouldIncludeImport} = plugin
  const activeFilepath = window.activeTextEditor.document.fileName
  const items = []

  for (const importPath of Object.keys(exportData).sort()) {
    const absImportPath = path.join(projectRoot, importPath)
    if (shouldIncludeImport && !shouldIncludeImport(absImportPath, activeFilepath)) {
      continue
    }

    const data = exportData[importPath]

    const ext = path.extname(importPath)
    const importPathNoExt = ext ? importPath.slice(0, -ext.length) : importPath
    let dotPath = importPathNoExt.replace(/\//g, '.')
    if (plugin.processImportPath) dotPath = plugin.processImportPath(dotPath)

    if (data.importEntirePackage) {
      items.push({
        label: importPath,
        isExtraImport: true,
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

async function insertImport(plugin, importSelection) {
  const {label: exportName, description: importPath, isExtraImport} = importSelection
  const editor = window.activeTextEditor

  const lines = editor.document.getText().split('\n')
  
  const linePosition = getLinePosition(plugin, importPath, isExtraImport, lines)
  return
  const lineImports = getNewLineImports(lines, exportName, linePosition)
  if (!lineImports) return
  const newLine = getNewLine(plugin, importPath, lineImports)
  
  const {lineIndex, lineIndexModifier, multiLineStart, isFirstImportLine} = linePosition
  
  await editor.edit(builder => {
    if (!lineIndexModifier) {
      builder.replace(new Range(multiLineStart || lineIndex, 0, lineIndex, lines[lineIndex].length), newLine)
    } else if (lineIndexModifier === 1) {
      builder.insert(new Position(lineIndex, lines[lineIndex].length), '\n' + newLine)
    } else { // -1
      // If it's the first import line, then add an extra new line between it and the subsequent non-import code.
      // We only need to worry about this here, because if `isFirstImportLine` = true, the only alternative
      // `lineIndexModifier` is 1, which occurs when the file only has comments
      const extraNewLine = isFirstImportLine ? '\n' : ''
      builder.insert(new Position(lineIndex, 0), newLine + '\n' + extraNewLine)
    }
  })
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
        const linePath = parseLineImportPath(line)
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

    const linePath = parseLineImportPath(lines[start])
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
    const sortBefore = plugin.shouldSortBeforeLinePath && plugin.shouldSortBeforeLinePath(importPath, linePath)
    if (sortBefore) return {start: importLineData[linePath].start, lineIndexModifier: -1}
    if (sortBefore === false) continue
    
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

function getNewLineImports(lines, exportName, exportType, linePosition) {
  const {lineIndex, multiLineStart, lineIndexModifier, isFirstImportLine} = linePosition

  const lineImports = lineIndexModifier || isFirstImportLine
    ? {named: [], types: []}
    : getLineImports(lines, multiLineStart == null ? lineIndex : multiLineStart)
  
  if (exportType === ExportType.default) {
    if (lineImports.default) return
    lineImports.default = exportName
  } else {
    const arr = lineImports[exportType === ExportType.named ? 'named' : 'types']
    if (arr.includes(exportName)) return
    arr.push(exportName)
  }

  return lineImports
}

function getNewLine(plugin, importPath, imports) {
  const {padCurlyBraces, quoteType, useSemicolons, maxImportLineLength, multilineImportStyle, commaDangle} = plugin

  imports.named.sort()
  imports.types.sort()
  const nonDefaultImports = imports.named.concat(imports.types.map(t => 'type ' + t))

  let newLineStart = 'import'
  if (imports.default) newLineStart += ' ' + imports.default

  let newLineMiddle = ''
  let newLineEnd = ''
  if (nonDefaultImports.length) {
    if (imports.default) newLineStart += ','
    newLineStart += ' {'
    if (padCurlyBraces) newLineStart += ' '
    newLineMiddle = nonDefaultImports.join(', ')
    if (padCurlyBraces) newLineEnd += ' '
    newLineEnd += '}'
  }

  const quoteChar = quoteType === 'single' ? '\'' : '"'
  newLineEnd += ' from ' + quoteChar + importPath + quoteChar
  if (useSemicolons) newLineEnd += ';'

  // Split up line if necessary

  const {options} = window.activeTextEditor
  const tabChar = options.insertSpaces ? _.repeat(' ', options.tabSize) : '\t'
  const newLineLength = newLineStart.length + newLineMiddle.length + newLineEnd.length

  // If line is short enough OR there are no named/type imports, no need to split into multiline
  if (newLineLength <= maxImportLineLength || !nonDefaultImports.length) {
    return newLineStart + newLineMiddle + newLineEnd
  }

  if (multilineImportStyle === 'single') {
    // trim start & end to remove possible curly brace padding
    const final = newLineStart.trim()
      + '\n'
      + tabChar
      + nonDefaultImports.join(',\n' + tabChar)
      + (commaDangle ? ',' : '')
      + '\n'
      + newLineEnd.trim()

    return final
  }

  let line = newLineStart
  let fullText = ''

  nonDefaultImports.forEach((name, i) => {
    const isLast = i === nonDefaultImports.length - 1

    let newText = (i > 0 ? ' ' : '') + name
    if (!isLast) newText += ','

    const newLength = line.length + newText.length
    // If it's the last import, we need to make sure that the line end "from ..." text will also fit on the line before
    // appending the new import text.
    if (
      (!isLast && newLength <= maxImportLineLength)
      || (isLast && newLength + newLineEnd <= maxImportLineLength)
    ) {
      line += newText
    } else {
      const newLine = tabChar + newText
      fullText += line + '\n' + newLine
      line = newLine
    }
  })

  return fullText + newLineEnd
}

function getRelativeImportPath(file, absImportPath) {
  const relativePath = path.relative(path.dirname(file), absImportPath)
  return relativePath[0] === '.' ? relativePath : '.' + path.sep + relativePath
}

module.exports = {
  buildImportItems,
  insertImport,
}
