import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Batches, CallToBatch } from '../types'

const batches = atom(
  { plugin: 'collapse-tools', key: 'batches' } as const,
  {} as Batches,
)
const callToBatch = atom(
  { plugin: 'collapse-tools', key: 'callToBatch' } as const,
  {} as CallToBatch,
)
const isEnabled = atom(
  { plugin: 'collapse-tools', key: 'isEnabled' } as const,
  true,
)

export const register: Register = on => {
  let currentBatch: string | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'collapse',
      description: 'Toggle collapsing of tool calls between agent messages',
    })
    return next(e)
  })

  on('command.run', { command: 'collapse' }, async $ => {
    const next = !(await read($, isEnabled))
    await update($, isEnabled, () => next)
    return { text: `collapse-tools ${next ? 'enabled' : 'disabled'}` }
  })

  on('turn.start', async ($, e, next) => {
    currentBatch = e.turnId
    const id = currentBatch
    await update($, batches, b => ({
      ...b,
      [id]: { ids: [], expanded: false },
    }))
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    currentBatch = null
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const bId = currentBatch
    if (bId !== null) {
      await update($, batches, b => {
        const prev = b[bId] ?? { ids: [], expanded: false }
        return { ...b, [bId]: { ...prev, ids: [...prev.ids, e.tool_use_id] } }
      })
      await update($, callToBatch, m => ({ ...m, [e.tool_use_id]: bId }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, isEnabled))) return next(e)
    const map = await read($, callToBatch)
    const bId = map[e.props.tool_use_id]
    if (bId === undefined) return next(e)
    const bs = await read($, batches)
    const batch = bs[bId]
    if (batch === undefined) return next(e)

    const isFirst = batch.ids[0] === e.props.tool_use_id
    const { Box, Button } = $.ui.resolve(e)
    const n = batch.ids.length
    const collapse = () =>
      update($, batches, b => ({
        ...b,
        [bId]: { ...b[bId], expanded: false },
      }))

    if (batch.expanded) {
      if (!isFirst) return next(e)
      const def = await next(e)
      return (
        <Box flexDirection="column">
          <Button
            key={`collapse-top-${bId}`}
            label={`v (${n} tool call${n === 1 ? '' : 's'} made) click to collapse`}
            dimColor
            onPress={collapse}
          />
          {def}
        </Box>
      )
    }

    if (!isFirst) return <Box />
    return (
      <Box>
        <Button
          key={`expand-${bId}`}
          label={`> (${n} tool call${n === 1 ? '' : 's'} made) click to expand`}
          dimColor
          onPress={() =>
            update($, batches, b => ({
              ...b,
              [bId]: { ...b[bId], expanded: true },
            }))
          }
        />
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await read($, isEnabled))) return next(e)
    const bs = await read($, batches)
    const expanded = Object.entries(bs).filter(([, b]) => b.expanded)
    if (expanded.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>expanded: </Text>
        {expanded.map(([bId, b]) => (
          <Button
            key={`collapse-band-${bId}`}
            label={`^ ${b.ids.length} collapse`}
            dimColor
            onPress={() =>
              update($, batches, bb => ({
                ...bb,
                [bId]: { ...bb[bId], expanded: false },
              }))
            }
          />
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, isEnabled))) return next(e)
    const map = await read($, callToBatch)
    const bId = map[e.props.tool_use_id]
    if (bId === undefined) return next(e)
    const bs = await read($, batches)
    const batch = bs[bId]
    if (batch === undefined || batch.expanded) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, isEnabled))) return next(e)
    const first = e.props.calls[0]
    const last = e.props.calls[e.props.calls.length - 1]
    if (first === undefined || last === undefined) return next(e)
    const map = await read($, callToBatch)
    const bId = map[first.tool_use_id]
    if (bId === undefined) return next(e)
    const bs = await read($, batches)
    const batch = bs[bId]
    if (batch === undefined) return next(e)

    const isFirst = batch.ids[0] === first.tool_use_id
    const { Box, Button } = $.ui.resolve(e)
    const n = batch.ids.length
    const collapse = () =>
      update($, batches, b => ({
        ...b,
        [bId]: { ...b[bId], expanded: false },
      }))

    if (batch.expanded) {
      if (!isFirst) return next(e)
      const def = await next(e)
      return (
        <Box flexDirection="column">
          <Button
            key={`collapse-top-${bId}`}
            label={`v (${n} tool call${n === 1 ? '' : 's'} made) click to collapse`}
            dimColor
            onPress={collapse}
          />
          {def}
        </Box>
      )
    }

    if (!isFirst) return <Box />
    return (
      <Box>
        <Button
          key={`expand-${bId}`}
          label={`> (${n} tool call${n === 1 ? '' : 's'} made) click to expand`}
          dimColor
          onPress={() =>
            update($, batches, b => ({
              ...b,
              [bId]: { ...b[bId], expanded: true },
            }))
          }
        />
      </Box>
    )
  })
}
