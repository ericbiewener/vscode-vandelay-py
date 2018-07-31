const fs = require('fs')
const _ = require('lodash')
const path = require('path')
const { commands, extensions, window, Uri, workspace } = require('vscode')
const expect = require('expect')
const { buildImportItems, insertImport } = require('../src/importing/importer')

afterEach(async function() {
  await commands.executeCommand('workbench.action.closeAllEditors')
  // Prevents test failures caused by text editors not being in expected open or closed state
  return new Promise(resolve => setTimeout(resolve, 10))
})

const root = workspace.workspaceFolders[0].uri.path

const getPlugin = () => extensions.getExtension('edb.vandelay-py').activate()

const getExportData = plugin =>
  JSON.parse(fs.readFileSync(plugin.cacheFilePath, 'utf-8'))

const openFile = (...fileParts) =>
  window.showTextDocument(
    Uri.file(
      fileParts.length
        ? path.join(...fileParts)
        : path.join(root, 'src1/file1.py')
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

it('cacheProject', async function() {
  const [plugin] = await Promise.all([
    getPlugin(),
    commands.executeCommand('vandelay.cacheProject'),
  ])
  expect(getExportData(plugin)).toMatchSnapshot(this)
})

it('buildImportItems', async function() {
  const { items } = await getImportItems()
  expect(items).toMatchSnapshot(this)
})

describe('insertImort', () => {
  const insertTest = async (context, filepath) => {
    context.timeout(1000 * 60)
    const open = () => openFile(filepath)
    const reopen = async () => {
      await commands.executeCommand('workbench.action.closeActiveEditor')
      await open(filepath)
    }

    const [plugin] = await Promise.all([getPlugin(), open()])

    const insert = async importArgs => {
      for (const args of importArgs) {
        await insertImport(plugin, {
          description: args[0],
          label: args[1],
          isExtraImport: args[2],
        })
      }
      return window.activeTextEditor.document.getText()
    }

    const importArgs = [
      ['src2.file1', 'CONSTANT_SRC2_FILE1_1'],
      ['apackage', 'apackage_fn', true],
      [null, 'full_package2', true],
      ['src1.file2', 'fn_file2_1'],
      [null, 'full_package1', true],
      ['group2a.subdir_1', 'group2a_1', true],
      ['group1a.subdir_1', 'group1a_1', true],
      ['src1.file1', 'CONSTANT_FILE1_1'],
      ['package3', 'package3_file1_3', true],
      ['group1a.subdir_2', 'group1a_2', true],
      ['src1.file1', 'Class_file1_1'],
      ['group1b.subdir_1', 'group1b_1', true],
      ['group2a.subdir_2', 'group2a_2', true],
      ['src1.file1', 'fn_file1_1'],
      ['group2b.subdir_1', 'group2b_1', true],
      ['package3', 'package3_file1_1', true],
      ['package3', 'package3_file1_2', true],
      ['src1.file1', 'CONSTANT_FILE1_2'],
      ['package3', 'package3_file2_1', true],
      ['package4', 'package4_file1_1', true],
      ['package3', 'package3_src2_file1_1', true],
      ['src1.file2', 'fn_file2_2'],
      ['package5', 'package5_file1_3', true],
      ['package4', 'package4_file1_2', true],
      ['src1.file1', 'fn_file1_2'],
      ['package4', 'package4_file1_3', true],
      ['package5', 'package5_file1_1', true],
      ['src1.file2', 'Class_file2_1'],
      ['src1.file2', 'Class_file2_2'],
      ['package5', 'package5_file1_2', true],
      ['src1.file1', 'Class_file1_2'],
    ]

    const originalResult = await insert(importArgs)
    expect(originalResult).toMatchSnapshot(context, 'original order')

    // eslint-disable-next-line no-unused-vars
    for (const i of _.range(10)) {
      await reopen()
      const newArray = _.shuffle(importArgs)
      const newResult = await insert(newArray)
      if (newResult !== originalResult)
        console.log(`\n\n${JSON.stringify(newArray)}\n\n`)
      expect(newResult).toBe(originalResult)
    }
  }

  it('insertImport - import order - comment-with-code-right-after.py', async function() {
    await insertTest(
      this,
      path.join(root, 'src1/insert-import/comment-with-code-right-after.py')
    )
  })

  it('insertImport - import order - comment-with-linebreak-and-code.py', async function() {
    await insertTest(
      this,
      path.join(root, 'src1/insert-import/comment-with-linebreak-and-code.py')
    )
  })

  it('insertImport - import order - empty.py', async function() {
    await insertTest(this, path.join(root, 'src1/insert-import/empty.py'))
  })

  it('insertImport - import order - has-code.py', async function() {
    await insertTest(this, path.join(root, 'src1/insert-import/has-code.py'))
  })

  it('insertImport - import order - multiline-comment.py', async function() {
    await insertTest(
      this,
      path.join(root, 'src1/insert-import/multiline-comment.py')
    )
  })

  it('insertImport - import order - single-line-comment.py', async function() {
    await insertTest(
      this,
      path.join(root, 'src1/insert-import/single-line-comment.py')
    )
  })

  it('insertImport - import package when partial import already exists', async function() {
    const [plugin] = await Promise.all([
      getPlugin(),
      openFile(path.join(root, 'src1/insert-import/empty.py')),
    ])

    await insertImport(plugin, {
      description: 'package1',
      label: 'import1',
      isExtraImport: true,
    })

    const text = window.activeTextEditor.document.getText()

    await insertImport(plugin, {
      label: 'package1',
      isExtraImport: true,
    })

    expect(text).toBe(window.activeTextEditor.document.getText())
  })

  it('insertImport - import partial when full package import already exists', async function() {
    const [plugin] = await Promise.all([
      getPlugin(),
      openFile(path.join(root, 'src1/insert-import/empty.py')),
    ])

    await insertImport(plugin, {
      label: 'package1',
      isExtraImport: true,
    })

    const text = window.activeTextEditor.document.getText()

    await insertImport(plugin, {
      description: 'package1',
      label: 'import1',
      isExtraImport: true,
    })

    expect(text).toBe(window.activeTextEditor.document.getText())
  })
})
