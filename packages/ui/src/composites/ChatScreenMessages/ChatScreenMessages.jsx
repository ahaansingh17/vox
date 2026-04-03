import { memo, useCallback, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import ChatMessage, { ToolGroup } from '../ChatMessage'
import ChatSkeleton from '../ChatSkeleton'
import ChatEmptyState from '../ChatEmptyState'
import { groupMessages } from './groupMessages'

export default memo(function ChatScreenMessages({
  allMessages,
  showSkeleton,
  loadingOlder,
  user,
  onChip,
  virtuosoRef,
  firstItemIndex,
  onStartReached,
  onAtBottomChange
}) {
  const grouped = useMemo(() => groupMessages(allMessages), [allMessages])

  const followOutput = useCallback((isAtBottom) => (isAtBottom ? 'smooth' : false), [])

  const itemContent = useCallback((_index, item) => {
    if (item.kind === 'tool-group') {
      return <ToolGroup tools={item.tools} />
    }
    return <ChatMessage message={item.message} />
  }, [])

  if (showSkeleton) {
    return <ChatSkeleton />
  }

  if (allMessages.length === 0) {
    return <ChatEmptyState user={user} onChip={onChip} />
  }

  return (
    <>
      {loadingOlder && <ChatSkeleton />}
      <Virtuoso
        ref={virtuosoRef}
        data={grouped}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={grouped.length - 1}
        followOutput={followOutput}
        atBottomStateChange={onAtBottomChange}
        startReached={onStartReached}
        atBottomThreshold={80}
        overscan={600}
        increaseViewportBy={200}
        itemContent={itemContent}
        className="chat-virtuoso"
      />
    </>
  )
})
