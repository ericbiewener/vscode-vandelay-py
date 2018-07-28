const { extensions } = require('vscode')
const { cacheFile, processCachedData } = require('./cacher')
const { buildImportItems, insertImport } = require('./importing/importer')

async function activate() {
  const vandelay = await extensions.getExtension('edb.vandelay').activate()

  const _test = {}

  vandelay.registerPlugin({
    language: 'py',
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
    multilineImportParentheses: true,
    finalizePlugin(plugin) {
      Object.assign(_test, plugin, {
        _test: vandelay._test,
      })
    },
  })

  return _test
}
exports.activate = activate
