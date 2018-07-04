// Imports
const importRegex = {
  entirePackage: /^import ([^\s]+)/gm,
  singleLine: /^from +?(.+) +?import +?([^(\n\\]+\n)/gm,
  multiline: /^from +?(.+) +?import +\(([\S\s]*?)\)/gm
}

function parseImportsWithRegex(text, regex, replacer, imports = []) {
  // Find the end of the initial imports. We don't want to consider any that appear later in the file,
  // e.g. local function imports
  const lines = text.split('\n')
  const firstNonImportLine = lines.findIndex(line => {
    line = line.trim()
    return (
      line &&
      !line.startsWith('import') &&
      !line.startsWith('from') &&
      !line.startsWith('#') &&
      !line.startsWith('"""')
    )
  })

  const importText = lines.slice(0, firstNonImportLine).join('\n')

  let match
  while ((match = regex.exec(importText))) {
    const results = {path: match[1]}
    // entirePackage regex does not provide a second matching group
    if (match[2]) results.imports = match[2].replace(replacer, '').split(',')
    imports.push(results)
  }
  return imports
}

function parseImports(text) {
  // Mutate imports for performance since this will be called a lot when caching an entire project
  const imports = parseImportsWithRegex(text, importRegex.entirePackage)
  parseImportsWithRegex(text, importRegex.singleLine, /\s/g, imports)
  return parseImportsWithRegex(text, importRegex.multiline, /[\s()]/g, imports)
}

// Comments
const comments = /^(?:[ \t]*#.*| *""".*\n?.*)/gm

// #TODO: make part of vandelay-core, that accets args of `text, singleLineRegex, multilineRegex`
function getLastInitialCommentLine(text) {
  // Iterates over comment line matches. If one doesn't begin where the previous one left off, this means
  // a non comment line came between them.
  let expectedNextIndex = 0
  let insertionIndex
  let match
  while (match = comments.exec(text)) {
    if (match.index !== expectedNextIndex) {
      insertionIndex = expectedNextIndex - 1
      break
    }
    expectedNextIndex = comments.lastIndex + 1
  }

  if (insertionIndex === 0) return 0
  if (insertionIndex) return text.slice(0, insertionIndex).split('\n').length - 1

}

module.exports = {
  parseImports,
  getLastInitialCommentLine,
}
