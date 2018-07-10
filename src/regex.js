const _ = require('lodash')

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
    if (match[2]) results.imports = _.compact(match[2].replace(replacer, '').split(','))
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

const commentRegex = /^(?:[ \t]*#|[ \t]*"""[^]*?""")/gm

module.exports = {
  parseImports,
  commentRegex,
}
