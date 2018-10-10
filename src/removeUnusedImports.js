const _ = require('lodash')
const { Range, Uri, window } = require('vscode')
const { getNewLine } = require('./importing/importer')
const { importRegex, parseImports } = require('./regex')

async function removeUnusedImports(plugin) {
  const diagnostics = plugin.utils.getDiagnosticsForCodes(['F401'])
  for (const filepath in diagnostics) {
    const editor = await window.showTextDocument(Uri.file(filepath), {
      preserveFocus: true,
      preview: false,
    })
    const { document } = editor
    const fullText = document.getText()
    const fileImports = parseImports(fullText)
    const changes = {}

    for (const diagnostic of diagnostics[filepath]) {
      // If importing entire package
      if (
        importRegex.entirePackage.test(
          document.lineAt(diagnostic.range.start.line)
        )
      ) {
        changes[importMatch.path] = { exports: [], match: importMatch }
        continue
      }

      // REGEX SEARCH BACKWARDS
      const offset = document.offsetAt(diagnostic.range.start)
      const importMatch = fileImports.find(
        i => i.start <= offset && i.end >= offset
      )
      if (!importMatch) return

      const { imports } = changes[importMatch.path] || importMatch
      // diagnostic.range only points to the start of the line, so we have to parse the import name
      // from diagnostic.message
      const unusedImport = plugin.utils.strUntil(
        _.last(diagnostic.message.split('.')),
        "'"
      )

      changes[importMatch.path] = {
        imports: imports ? imports.filter(n => n !== unusedImport) : [],
        match: importMatch,
      }
    }

    const orderedChanges = _.sortBy(changes, c => -c.match.start)

    await editor.edit(builder => {
      for (const change of orderedChanges) {
        const { imports, match } = change
        const newLine = imports.length
          ? getNewLine(plugin, match.path, imports)
          : ''

        console.info(
          document.getText()[match.end + 1] !== '\n',
          document.getText()[match.end + 1] !== '\n'
        )

        builder.replace(
          new Range(
            // Delete previous \n if newLine is empty
            document.positionAt(newLine ? match.start : match.start - 1),
            // Delete following \n if newLine is empty and there are two \n\n following it, or if
            // we're at the start of the file
            document.positionAt(
              match.start &&
              (newLine || document.getText()[match.end + 1] !== '\n')
                ? match.end
                : match.start
                  ? match.end + 1
                  : match.end + 2
            )
          ),
          newLine
        )
      }
    })

    await document.save()
  }
}

module.exports = {
  removeUnusedImports,
}
