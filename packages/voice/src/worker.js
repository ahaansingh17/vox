const { parentPort, workerData } = require('worker_threads')
const ort = require('onnxruntime-node')
const CHUNK_SAMPLES = 1280
const MEL_CONTEXT = 480
const RAW_BUF_MAX = 16000 * 10
const MEL_DIMS = 32
const EMBED_DIMS = 96
const MEL_WINDOW = 76
const EMBED_WINDOW = 16
const WAKE_THRESHOLD = 0.5
let sessions = null
let running = false
let paused = false
let recorder = null
const warmFrame = () => new Float32Array(MEL_DIMS).fill(1.0)
const ringStorage = new Int16Array(RAW_BUF_MAX)
let ringHead = 0
let ringCount = 0
const melInputBuf = new Float32Array(CHUNK_SAMPLES + MEL_CONTEXT)
let melBuffer = Array.from(
  {
    length: MEL_WINDOW
  },
  warmFrame
)
let embedBuffer = []
const ringAppend = (int16Array) => {
  const n = int16Array.length
  for (let i = 0; i < n; i++) {
    ringStorage[ringHead] = int16Array[i]
    ringHead = (ringHead + 1) % RAW_BUF_MAX
  }
  ringCount = Math.min(ringCount + n, RAW_BUF_MAX)
}
const ringTailToFloat32 = (count) => {
  const actual = Math.min(count, ringCount)
  const start = (ringHead - actual + RAW_BUF_MAX) % RAW_BUF_MAX
  for (let i = 0; i < actual; i++) {
    melInputBuf[i] = ringStorage[(start + i) % RAW_BUF_MAX]
  }
  return actual
}
const resetBuffers = () => {
  ringHead = 0
  ringCount = 0
  melBuffer = Array.from(
    {
      length: MEL_WINDOW
    },
    warmFrame
  )
  embedBuffer = []
}
const loadSessions = async () => {
  const { base } = workerData
  const { join } = require('path')
  sessions = {
    mel: await ort.InferenceSession.create(join(base, 'melspectrogram.onnx')),
    embed: await ort.InferenceSession.create(join(base, 'embedding_model.onnx')),
    wakeWord: await ort.InferenceSession.create(join(base, 'computer.onnx'))
  }
}
const startRecorderLoop = async () => {
  const { PvRecorder } = require('@picovoice/pvrecorder-node')
  recorder = new PvRecorder(CHUNK_SAMPLES)
  recorder.start()
  running = true
  const loop = async () => {
    if (!running) {
      try {
        recorder.stop()
        recorder.release()
      } catch (err) {
        parentPort.postMessage({
          type: 'error',
          message: `Recorder cleanup failed: ${err.message}`
        })
      }
      return
    }
    try {
      const frame = await recorder.read()
      if (!paused && frame && frame.length === CHUNK_SAMPLES) {
        await processFrame(new Int16Array(frame))
      }
    } catch (err) {
      parentPort.postMessage({ type: 'error', message: `Frame read error: ${err.message}` })
    }
    if (running) setImmediate(loop)
  }
  setImmediate(loop)
}
const runMel = async (audioF32, length) => {
  const inputName = sessions.mel.inputNames[0]
  const out = await sessions.mel.run({
    [inputName]: new ort.Tensor('float32', audioF32, [1, length])
  })
  const output = out[sessions.mel.outputNames[0]]
  const nFrames = output.dims[2]
  const frames = []
  for (let i = 0; i < nFrames; i++) {
    const raw = output.data.slice(i * MEL_DIMS, (i + 1) * MEL_DIMS)
    const transformed = new Float32Array(MEL_DIMS)
    for (let j = 0; j < MEL_DIMS; j++) transformed[j] = raw[j] / 10 + 2
    frames.push(transformed)
  }
  return frames
}
const runEmbed = async () => {
  const window = melBuffer.slice(-MEL_WINDOW)
  const flat = new Float32Array(MEL_WINDOW * MEL_DIMS)
  for (let i = 0; i < MEL_WINDOW; i++) flat.set(window[i], i * MEL_DIMS)
  const inputName = sessions.embed.inputNames[0]
  const out = await sessions.embed.run({
    [inputName]: new ort.Tensor('float32', flat, [1, MEL_WINDOW, MEL_DIMS, 1])
  })
  return Float32Array.from(out[sessions.embed.outputNames[0]].data.slice(0, EMBED_DIMS))
}
const runWakeWord = async () => {
  const flat = new Float32Array(EMBED_WINDOW * EMBED_DIMS)
  for (let i = 0; i < EMBED_WINDOW; i++) flat.set(embedBuffer[i], i * EMBED_DIMS)
  const inputName = sessions.wakeWord.inputNames[0]
  const out = await sessions.wakeWord.run({
    [inputName]: new ort.Tensor('float32', flat, [1, EMBED_WINDOW, EMBED_DIMS])
  })
  return out[sessions.wakeWord.outputNames[0]].data[0]
}
const processFrame = async (int16Array) => {
  ringAppend(int16Array)
  if (ringCount < CHUNK_SAMPLES + MEL_CONTEXT) return
  const melLen = ringTailToFloat32(CHUNK_SAMPLES + MEL_CONTEXT)
  const newFrames = await runMel(melInputBuf, melLen)
  melBuffer.push(...newFrames)
  if (melBuffer.length > MEL_WINDOW * 4) melBuffer = melBuffer.slice(-MEL_WINDOW * 4)
  const embedding = await runEmbed()
  embedBuffer.push(embedding)
  if (embedBuffer.length > EMBED_WINDOW) embedBuffer = embedBuffer.slice(-EMBED_WINDOW)
  if (embedBuffer.length === EMBED_WINDOW) {
    const score = await runWakeWord()
    if (score > WAKE_THRESHOLD) {
      parentPort.postMessage({
        type: 'detected'
      })
    }
  }
}
parentPort.on('message', (msg) => {
  if (msg.type === 'pause') {
    paused = true
    resetBuffers()
  } else if (msg.type === 'resume') {
    paused = false
  } else if (msg.type === 'stop') {
    running = false
    if (recorder) {
      try {
        recorder.stop()
      } catch {
        void 0
      }
      try {
        recorder.release()
      } catch {
        void 0
      }
      recorder = null
    }
    if (sessions) {
      for (const s of Object.values(sessions)) {
        try {
          s.release()
        } catch {
          void 0
        }
      }
      sessions = null
    }
    process.exit(0)
  }
})
const init = async () => {
  await loadSessions()
  await startRecorderLoop()
  parentPort.postMessage({
    type: 'ready'
  })
}
init().catch((err) => {
  parentPort.postMessage({
    type: 'error',
    message: err.message
  })
})
