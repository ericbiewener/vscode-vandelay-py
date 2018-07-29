const path = require('path')

const src1 = path.join(__dirname, 'src1')
const src2 = path.join(__dirname, 'src2')

module.exports = {
  maxImportLineLength: 120,
  includePaths: [
    src1,
    src2,
  ],
  importGroups: [
    ['group1a', 'group1b'],
    ['group2a', 'group2b'],
    ['src1', 'src2'],
  ],
  excludePatterns: [
    path.join(src1, 'insert-import'),
  ]
}
