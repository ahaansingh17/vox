const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@huggingface',
  'transformers',
  'node_modules',
  'onnxruntime-node'
)

if (!fs.existsSync(target)) process.exit(0)

fs.rmSync(target, { recursive: true, force: true })
fs.mkdirSync(target)
fs.writeFileSync(
  path.join(target, 'package.json'),
  JSON.stringify({ name: 'onnxruntime-node', version: '0.0.0', main: 'index.js' })
)
fs.writeFileSync(path.join(target, 'index.js'), 'module.exports = require("onnxruntime-web")\n')

console.log('patched onnxruntime-node → onnxruntime-web')
