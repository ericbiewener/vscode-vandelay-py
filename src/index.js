const { commands, extensions, window } = require('vscode')
const semver = require('semver-compare')
const { cacheFile, processCachedData } = require('./cacher')
const { buildImportItems, insertImport } = require('./importing/importer')

async function activate() {
  console.log('Vandelay Python: Activating')
  const ext = extensions.getExtension('edb.vandelay')
  if (!ext) {
    window.showErrorMessage(
      'You must install the core Vandelay package to use Vandelay Python: https://github.com/ericbiewener/vscode-vandelay'
    )
    return
  }
  if (semver(ext.packageJSON.version, '1.0.1') < 0) {
    window.showErrorMessage(
      'Your core Vandelay package needs to be updated. Vandelay Python will not work until you update.'
    )
    await commands.executeCommand(
      'workbench.extensions.action.listOutdatedExtensions'
    )
    return
  }

  const vandelay = await ext.activate()

  const _test = {}

  console.log('Vandelay Python: registerPlugin')
  vandelay.registerPlugin({
    language: 'py',
    cacheFile,
    processCachedData,
    buildImportItems,
    insertImport,
    multilineImportParentheses: true,
    undefinedVariableCodes: ['F821'],
    finalizePlugin(plugin) {
      console.log('Vandelay Python: finalized', plugin)
      plugin._test = vandelay._test
      _test.plugin = plugin
    },
  })

  return _test
}
exports.activate = activate
