# @vox-ai-app/vox-ui

Shared React component library for the Vox design system. Built with Vite, exported as pre-built ESM.

## Install

```sh
npm install @vox-ai-app/vox-ui
```

Peer dependencies: `react >= 19`, `react-dom >= 19`

## Setup

Import the base styles once in your app entry:

```js
import '@vox-ai-app/vox-ui/styles.css'
```

## Components

### Primitives

Low-level, unstyled-ish building blocks.

```js
import {
  IconButton,
  CopyButton,
  Drawer,
  Skeleton,
  Toast,
  ExpandableMarkdown
} from '@vox-ai-app/vox-ui/primitives'
```

### Composites

Feature components built from primitives.

```js
import {
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  ChatSkeleton,
  ActionItem,
  ActivityListRow,
  ActivityTimeline,
  ExplorerSidebar,
  ExplorerTile,
  VoiceOrb
} from '@vox-ai-app/vox-ui/composites'
```

### Layouts

Full-page layout shells.

```js
import { AppShell, LeftRail, UserMenu } from '@vox-ai-app/vox-ui/layouts'
```

### Hooks

```js
import {} from /* hooks */ '@vox-ai-app/vox-ui/hooks'
```

### Utils

```js
import { cn } from '@vox-ai-app/vox-ui/utils'
// cn(...classes) — merges Tailwind class names
```

### Tokens

Design tokens as JS constants or CSS custom properties.

```js
import { colors } from '@vox-ai-app/vox-ui/tokens'
```

```css
@import '@vox-ai-app/vox-ui/tokens.css';
/* exposes --vox-color-* custom properties */
```

## All exports

```js
import {} from /* everything */ '@vox-ai-app/vox-ui'
```

## License

MIT
