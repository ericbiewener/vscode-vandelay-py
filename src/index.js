const { extensions, window } = require('vscode')
const { cacheFile, processCachedData } = require('./cacher')
const { buildImportItems, insertImport } = require('./importing/importer')

async function activate() {
  const ext = extensions.getExtension('edb.vandelay')
  if (!ext) {
    window.showErrorMessage(
      'You must install the core Vandelay package to use Vandelay Python: https://github.com/ericbiewener/vscode-vandelay'
    )
    return
  }
  const vandelay = await ext.activate()

  const _test = {}

  vandelay.registerPlugin({
    language: 'py',
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
    multilineImportParentheses: true,
    finalizePlugin(plugin) {
      plugin._test = vandelay._test
      _test.plugin = plugin
    },
  })

  return _test
}
exports.activate = activate
