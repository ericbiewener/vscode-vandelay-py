const { extensions } = require('vscode')
const { cacheFile, processCachedData } = require('./cacher')
const { buildImportItems, insertImport } = require('./importing/importer')

async function activate() {
  const vandelay = await extensions.getExtension('edb.vandelay').activate()

  let api; // just used for testing

  vandelay.registerPlugin({
    language: 'py',
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
    multilineImportParentheses: true,
    finalizePlugin(plugin) {
      api = plugin
    },
  })

  return api;
}
exports.activate = activate
