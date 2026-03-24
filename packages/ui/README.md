# @info-arnav/vox-ui

Shared React component library for the Vox design system. Built with Vite, exported as pre-built ESM.

## Install

```sh
npm install @info-arnav/vox-ui
```

Peer dependencies: `react >= 19`, `react-dom >= 19`

## Setup

Import the base styles once in your app entry:

```js
import '@info-arnav/vox-ui/styles.css'
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
} from '@info-arnav/vox-ui/primitives'
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
} from '@info-arnav/vox-ui/composites'
```

### Layouts

Full-page layout shells.

```js
import { AppShell, LeftRail, UserMenu } from '@info-arnav/vox-ui/layouts'
```

### Hooks

```js
import {} from /* hooks */ '@info-arnav/vox-ui/hooks'
```

### Utils

```js
import { cn } from '@info-arnav/vox-ui/utils'
// cn(...classes) — merges Tailwind class names
```

### Tokens

Design tokens as JS constants or CSS custom properties.

```js
import { colors } from '@info-arnav/vox-ui/tokens'
```

```css
@import '@info-arnav/vox-ui/tokens.css';
/* exposes --vox-color-* custom properties */
```

## All exports

```js
import {} from /* everything */ '@info-arnav/vox-ui'
```

## License

MIT
