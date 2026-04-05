const { parentPort } = require('worker_threads')
const path = require('path')

let embedder = null

async function init(cacheDir) {
  const { pipeline, env } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = true
  env.backends.onnx.wasm.wasmPaths = path.dirname(require.resolve('onnxruntime-web')) + '/'
  env.backends.onnx.wasm.proxy = false

  parentPort.postMessage({ type: 'status', status: 'downloading' })

  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
    session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        parentPort.postMessage({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total })
      }
    }
  })

  parentPort.postMessage({ type: 'ready' })
}

async function embed(id, text) {
  if (!embedder) {
    parentPort.postMessage({ id, error: 'Embedder not initialized' })
    return
  }

  const output = await embedder(text, { pooling: 'mean', normalize: true })
  parentPort.postMessage({ id, embedding: Array.from(output.data) })
}

parentPort.on('message', async (msg) => {
  try {
    if (msg.type === 'init') await init(msg.cacheDir)
    else if (msg.type === 'embed') await embed(msg.id, msg.text)
  } catch (err) {
    if (msg.id !== undefined) {
      parentPort.postMessage({ id: msg.id, error: err.message })
    } else {
      parentPort.postMessage({ type: 'error', message: err.message })
    }
  }
})
