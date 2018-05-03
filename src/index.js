const {extensions} = require('vscode')
const {cacheFile, processCachedData} = require('./cacher')
const {buildImportItems, insertImport} = require('./importer')

async function activate() {
  const vandelay = await extensions.getExtension('edb.vandelay').activate()

  vandelay.registerPlugin({
    language: 'py',
    importsAreArrays: true,
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
  })
}
exports.activate = activate
