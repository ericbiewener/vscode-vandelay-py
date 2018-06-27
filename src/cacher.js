const fs = require('fs-extra')
const _ = require('lodash')
const {parseLineImportPath, isPathPackage, getLineImports} = require('./utils')

function cacheFile(plugin, filepath, data = {_extraImports: {}}) {
  const classes = []
  const functions = []
  const constants = []
  let multiLineStart
  let multiLineUsingParens

  const lines = fs.readFileSync(filepath, 'utf8').split('\n')

  lines.forEach((line, i) => {
    // Importing entire module
    if (line.startsWith('import ')) {
      const linePath = line.split(' ')[1]
      
      if (isPathPackage(plugin, linePath)) {
        const existing = data._extraImports[linePath] || {}
        existing.importEntirePackage = true;
        data._extraImports[linePath] = existing
      } else {
        data[linePath] = {importEntirePackage: true}
      }

      return
    }
    
    const isImportStart = line.startsWith('from ')
    const linePath = isImportStart ? parseLineImportPath(plugin, line) : null
    if (isImportStart && !isPathPackage(plugin, linePath)) return

    if (isImportStart || multiLineStart != null) {
    
      // If multiline, just continue looping until we find the end
      if (multiLineStart != null) {
        if (multiLineUsingParens) {
          if (!line.endsWith(')')) return
        } else {
          if (line.endsWith('\\')) return
        }
      }
      // Check if starting multiline
      else {
        const hasParens = line.includes(' import (') && !line.endsWith(')')
        if (hasParens || line.endsWith('\\')) {
          multiLineStart = i
          multiLineUsingParens = hasParens
          return
        }
      }

      const importStartLine = isImportStart ? i : multiLineStart
      const startLinePath = isImportStart ? linePath : parseLineImportPath(plugin, lines[importStartLine])
      multiLineStart = null
      
      const lineImports = getLineImports(lines, importStartLine)
      const existing = data._extraImports[startLinePath] || {}

      existing.exports = _.union(existing.exports, lineImports)
      data._extraImports[startLinePath] = existing
      return
    }

    const words = line.split(' ')
    const word0 = words[0]
    const word1 = words[1]

    // Class
    if (word0 === 'class') {
      classes.push(trimClassOrFn(word1))
    }
    // Function
    else if (word0 === 'def') {
      if (!word1.startsWith('_')) {
        functions.push(trimClassOrFn(word1))
      }
    }
    // Constant
    else if (word1 === '=' && word0.toUpperCase() === word0) {
      constants.push(word0)
    }
  })

  const exp = [...classes, ...functions, ...constants]
  if (exp.length) data[plugin.utils.getFilepathKey(filepath)] = { exports: exp }

  return data
}

function trimClassOrFn(str) {
  return str.slice(0, str.indexOf('('))
}

module.exports = {
  cacheFile,
}
