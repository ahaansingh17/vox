export const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.mdx',
  '.adoc',
  '.asciidoc',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.sql',
  '.graphql',
  '.gql',
  '.sh',
  '.zsh',
  '.bash',
  '.pdf',
  '.doc',
  '.docx',
  '.docm',
  '.ppt',
  '.pptx',
  '.pptm',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.odt',
  '.odp',
  '.ods',
  '.rtf'
])
export const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.idea',
  '.vscode'
])
export const MAX_TEXT_CHARS = 512_000
export const MAX_QUEUE_SIZE = 200
export const WORKER_CONCURRENCY = 4
export const MAX_RETRY_ATTEMPTS = 2
export const REMOVE_BATCH_SIZE = 200
export const DELETE_DRAIN_RETRY_DELAY_MS = 15_000
export const STATUS_EVENT_LIMIT = 120
export const RECONCILE_DEBOUNCE_MS = 700
export const FULL_RECONCILE_INTERVAL_MS = 10 * 60_000
export const KNOWLEDGE_CHUNK_MAX_CHARS = 1400
export const KNOWLEDGE_CHUNK_OVERLAP = 200
export const KNOWLEDGE_CHUNK_MIN_BREAK_CHARS = 800
export const KNOWLEDGE_SEARCH_DEFAULT_PAGE_SIZE = 5
export const KNOWLEDGE_SEARCH_MAX_PAGE_SIZE = 10
export const INDEX_ENGINE_VERSION = '4'
