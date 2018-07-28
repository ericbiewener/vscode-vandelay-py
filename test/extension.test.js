const fs = require('fs')
const path = require('path')
const { commands, extensions, window, Uri, workspace } = require('vscode')
const expect = require('expect')
const { buildImportItems, insertImport } = require('../src/importing/importer')

const root = workspace.workspaceFolders[0].uri.path

const getPlugin = () => extensions.getExtension('edb.vandelay-py').activate()

const getExportData = plugin =>
  JSON.parse(fs.readFileSync(plugin.cacheFilePath, 'utf-8'))

const openFile = (...fileParts) =>
  window.showTextDocument(
    Uri.file(
      fileParts.length ? path.join(...fileParts) : path.join(root, 'src1/file1.py')
    )
  )

const getImportItems = async (...fileParts) => {
  const [plugin] = await Promise.all([getPlugin(), openFile(...fileParts)])
  const data = getExportData(plugin)
  data['src2/file1.py'].cached = Date.now()
  return {
    items: plugin._test.getImportItems(plugin, data, buildImportItems),
    plugin,
  }
}

suite("howdy", function() {
  beforeEach(function() {
    console.log('before every test in every file');
  });

  test.only('insertImport', async function() {
    const fileRoot = path.join(root, 'src1/insert-import')
    const { items, plugin } = await getImportItems(fileRoot, 'empty.py')
    await insertImport(plugin, items[0])
    expect(window.activeTextEditor.document.getText()).toMatchSnapshot(this)

    await openFile(fileRoot, 'has-code.py')
    await insertImport(plugin, items[0])
    expect(window.activeTextEditor.document.getText()).toMatchSnapshot(this)
  })
})

// test('cacheProject', async function() {
//   const [plugin] = await Promise.all([
//     getPlugin(),
//     commands.executeCommand('vandelay.cacheProject'),
//   ])
//   expect(getExportData(plugin)).toMatchSnapshot(this)
// })

// test('buildImportItems', async function() {
//   this.timeout(5000)
//   const { items } = await getImportItems()
//   expect(items).toMatchSnapshot(this)
// })
