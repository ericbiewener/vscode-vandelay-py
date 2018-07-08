const {extensions} = require('vscode')
const {cacheFile, processCachedData} = require('./cacher')
const {buildImportItems, insertImport} = require('./importing/importer')

async function activate() {
  const vandelay = await extensions.getExtension('edb.vandelay').activate()

  vandelay.registerPlugin({
    language: 'py',
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
    multilineImportParentheses: true,
  })
}
exports.activate = activate
