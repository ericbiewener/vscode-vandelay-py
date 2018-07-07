/**
 * Regexes must end with `.*` after last capturing group to ensure that we capture the full line.
 * This is necessary so that the `end` property in the results is the correct character.
 * 
 * Matching groups:
 *    1. path
 *    2. imports
 */
// TODO: review regexes now that i am better at it...
const importRegex = {
  entirePackage: /^import ([^\s]+)/gm,
  singleLine: /^from +(.+) +import +([^#"]*).*/gm,
  multiline: /^from +?(.+) +?import +\(([\S\s]*?)\).*/gm,
}

function parseImportsWithRegex(text, regex, replacer, imports = []) {
  let match
  while ((match = regex.exec(text))) {
    const results = {
      path: match[1],
      start: match.index,
      end: match.index + match[0].length,
    }
    if (match[2]) results.imports = match[2].replace(replacer, '').split(',')
    imports.push(results)
  }

  regex.lastIndex = 0;
  return imports
}

function parseImports(text) {
  // Mutate imports
  const imports = parseImportsWithRegex(text, importRegex.entirePackage)
  parseImportsWithRegex(text, importRegex.singleLine, /\s/g, imports)
  return parseImportsWithRegex(text, importRegex.multiline, /[\s()]/g, imports)
}

// Comments
const comments = /^(?:[ \t]*#|[ \t]*"""[^]*?""")/gm

// #TODO: make part of vandelay-core, that accets args of `text, singleLineRegex, multilineRegex`
function getLastInitialComment(text) {
  // Iterates over comment line matches. If one doesn't begin where the previous one left off, this means
  // a non comment line came between them.
  let expectedNextIndex = 0
  let match
  let prevMatch
  while ((match = comments.exec(text))) {
    if (match.index !== expectedNextIndex) break
    expectedNextIndex = comments.lastIndex + 1
    prevMatch = match
  }

  return prevMatch
}

module.exports = {
  parseImports,
  getLastInitialComment,
}
