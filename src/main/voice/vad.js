import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

const SAMPLE_RATE = 16000
const CHUNK_SIZE = 512
const CONTEXT_SIZE = 64
const SPEECH_THRESHOLD = 0.5
const MIN_SPEECH_FRAMES = 3
const MIN_SILENCE_FRAMES = 8

let session = null
let state = null
let context = null
let speechFrameCount = 0
let silenceFrameCount = 0
let speaking = false

function modelPath() {
  const base = is.dev
    ? join(app.getAppPath(), 'resources/voice')
    : join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'resources/voice')
  return join(base, 'silero_vad.onnx')
}

function createInitialState(ort) {
  return new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128])
}

export async function initVad() {
  const ort = require('onnxruntime-web')
  session = await ort.InferenceSession.create(modelPath(), {
    intraOpNumThreads: 1,
    interOpNumThreads: 1
  })
  state = createInitialState(ort)
  context = new Float32Array(CONTEXT_SIZE)
  speechFrameCount = 0
  silenceFrameCount = 0
  speaking = false
}

export async function processSamples(int16Samples) {
  if (!session) return { speech: false, probability: 0 }

  const ort = require('onnxruntime-web')
  const audioFloat = new Float32Array(CHUNK_SIZE)
  const len = Math.min(int16Samples.length, CHUNK_SIZE)
  for (let i = 0; i < len; i++) audioFloat[i] = int16Samples[i] / 32768

  const inputWithContext = new Float32Array(CONTEXT_SIZE + CHUNK_SIZE)
  inputWithContext.set(context, 0)
  inputWithContext.set(audioFloat, CONTEXT_SIZE)

  context = inputWithContext.slice(-CONTEXT_SIZE)

  const input = new ort.Tensor('float32', inputWithContext, [1, CONTEXT_SIZE + CHUNK_SIZE])
  const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]))

  const result = await session.run({ input, sr, state })
  state = result.stateN
  const probability = result.output.data[0]

  if (probability >= SPEECH_THRESHOLD) {
    speechFrameCount++
    silenceFrameCount = 0
    if (speechFrameCount >= MIN_SPEECH_FRAMES && !speaking) {
      speaking = true
      return { speech: true, probability, event: 'start' }
    }
    return { speech: speaking, probability }
  }

  silenceFrameCount++
  if (speaking && silenceFrameCount >= MIN_SILENCE_FRAMES) {
    speaking = false
    speechFrameCount = 0
    return { speech: false, probability, event: 'end' }
  }

  if (!speaking) speechFrameCount = 0
  return { speech: speaking, probability }
}

export function resetVad() {
  if (!session) return
  const ort = require('onnxruntime-web')
  state = createInitialState(ort)
  context = new Float32Array(CONTEXT_SIZE)
  speechFrameCount = 0
  silenceFrameCount = 0
  speaking = false
}

export function isVadReady() {
  return session !== null
}

export async function destroyVad() {
  if (session) {
    const s = session
    session = null
    try {
      await s.release()
    } catch {
      // onnx session may already be freed
    }
  }
  state = null
  speechFrameCount = 0
  silenceFrameCount = 0
  speaking = false
}
