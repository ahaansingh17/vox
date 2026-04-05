# Changelog

## [1.0.2] - 2026-04-05

### Changed

- Peer dependency changed from `onnxruntime-node` to `onnxruntime-web` — eliminates Electron ABI crash.
- Worker uses WASM backend via `onnxruntime-web` (same `InferenceSession`/`Tensor` API).

## [1.0.1] - 2026-03-25

### Added

- Status update forwarding from worker to host process.

## [1.0.0] - 2026-03-24

- Initial release: ONNX wake word detection, keyboard shortcut registration, voice overlay window.
