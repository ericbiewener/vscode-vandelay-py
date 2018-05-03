const fs = require('fs-extra')

// TODO: extraImport parsing

function cacheFile(plugin, filepath, data = {_extraImports: {}}) {
  const classes = []
  const functions = []
  const constants = []

  const lines = fs.readFileSync(filepath, 'utf8').split('\n')
  for (const line of lines) {
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
  }

  const exp = [...classes, ...functions, ...constants]
  if (exp.length) data[plugin.utils.getFilepathKey(filepath)] = exp

  return data
}

function trimClassOrFn(str) {
  return str.slice(0, str.indexOf('('))
}

module.exports = {
  cacheFile,
}
