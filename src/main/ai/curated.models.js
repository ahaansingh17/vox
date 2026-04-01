export const CURATED_MODELS = [
  {
    id: 'qwen3-4b',
    label: 'Qwen 3 4B',
    description: 'Fast with full tool support. Recommended default.',
    hfRepo: 'Qwen/Qwen3-4B-GGUF',
    hfFile: 'Qwen3-4B-Q4_K_M.gguf',
    sizeGB: 2.5,
    minRamGB: 16,
    isDefault: true
  },
  {
    id: 'qwen3-8b',
    label: 'Qwen 3 8B',
    description: 'Stronger reasoning and tool use.',
    hfRepo: 'Qwen/Qwen3-8B-GGUF',
    hfFile: 'Qwen3-8B-Q4_K_M.gguf',
    sizeGB: 5.0,
    minRamGB: 16,
    isDefault: false
  },
  {
    id: 'qwen3-14b',
    label: 'Qwen 3 14B',
    description: 'High quality reasoning. Needs 32GB+ RAM.',
    hfRepo: 'Qwen/Qwen3-14B-GGUF',
    hfFile: 'Qwen3-14B-Q4_K_M.gguf',
    sizeGB: 9.0,
    minRamGB: 32,
    isDefault: false
  },
  {
    id: 'qwen3-32b',
    label: 'Qwen 3 32B',
    description: 'Best local quality. Needs 64GB+ RAM.',
    hfRepo: 'Qwen/Qwen3-32B-GGUF',
    hfFile: 'Qwen3-32B-Q4_K_M.gguf',
    sizeGB: 19.8,
    minRamGB: 64,
    isDefault: false
  }
]

export const DEFAULT_MODEL = CURATED_MODELS.find((m) => m.isDefault)
