import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, RenderInput } from 'claude-code'

import type { Batches, CallToBatch } from '../types'

const batches = atom(
  { plugin: 'collapse-tool-use', key: 'batches' } as const,
  {} as Batches,
)
const callToBatch = atom(
  { plugin: 'collapse-tool-use', key: 'callToBatch' } as const,
  {} as CallToBatch,
)
const isEnabled = atom(
  { plugin: 'collapse-tool-use', key: 'isEnabled' } as const,
  true,
)

const batchesKey = (sid: string) => `batches:${sid}`
const callToBatchKey = (sid: string) => `callToBatch:${sid}`

const plural = (n: number, one: string, many: string) =>
  n === 1 ? `${n} ${one}` : `${n} ${many}`

async function persistBatches($: EngineInterface, sid: string | null) {
  if (sid === null) return
  await $.store.set(batchesKey(sid), await read($, batches))
}

async function persistCallToBatch($: EngineInterface, sid: string | null) {
  if (sid === null) return
  await $.store.set(callToBatchKey(sid), await read($, callToBatch))
}

async function setBatchExpanded(
  $: EngineInterface,
  sid: string | null,
  bId: string,
  expanded: boolean,
) {
  await update($, batches, b => ({
    ...b,
    [bId]: { ...b[bId], expanded },
  }))
  await persistBatches($, sid)
}

async function renderBatchAnchor(
  $: EngineInterface,
  e: RenderInput<'ToolUse' | 'ToolGroup'>,
  next: (e: RenderInput<'ToolUse' | 'ToolGroup'>) => Promise<unknown>,
  anchorId: string,
  sid: string | null,
) {
  if (!(await read($, isEnabled))) return next(e)
  const map = await read($, callToBatch)
  const bId = map[anchorId]
  if (bId === undefined) return next(e)
  const bs = await read($, batches)
  const batch = bs[bId]
  if (batch === undefined) return next(e)

  const isFirst = batch.ids[0] === anchorId
  const n = batch.ids.length
  const label = plural(n, 'tool call', 'tool calls')
  const { Box, Button } = $.ui.resolve(e)

  if (batch.expanded) {
    if (!isFirst) return next(e)
    const def = await next(e)
    return (
      <Box flexDirection="column">
        <Button
          key={`collapse-top-${bId}`}
          label={`v (${label} made) click to collapse`}
          dimColor
          onPress={() => setBatchExpanded($, sid, bId, false)}
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
        label={`> (${label} made) click to expand`}
        dimColor
        onPress={() => setBatchExpanded($, sid, bId, true)}
      />
    </Box>
  )
}

export const register: Register = on => {
  let currentBatch: string | null = null
  let sessionId: string | null = null

  on('session.start', async ($, e, next) => {
    sessionId = await $.session.id()
    const en = (await $.store.get('isEnabled')) as boolean | undefined
    if (en !== undefined) await update($, isEnabled, () => en)
    const bs = (await $.store.get(batchesKey(sessionId))) as
      | Batches
      | undefined
    if (bs !== undefined) await update($, batches, () => bs)
    const c = (await $.store.get(callToBatchKey(sessionId))) as
      | CallToBatch
      | undefined
    if (c !== undefined) await update($, callToBatch, () => c)

    await $.command.register({
      name: 'collapse',
      description:
        'Toggle collapse-tool-use: hide or show tool calls between agent messages',
    })
    return next(e)
  })

  on('command.run', { command: 'collapse' }, async $ => {
    const nextVal = !(await read($, isEnabled))
    await update($, isEnabled, () => nextVal)
    await $.store.set('isEnabled', nextVal)
    return { text: `collapse-tool-use ${nextVal ? 'enabled' : 'disabled'}` }
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

  on('turn.complete', async ($, e, next) => {
    currentBatch = null
    await persistBatches($, sessionId)
    await persistCallToBatch($, sessionId)
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

  on('ui.render', { component: 'ToolUse' }, ($, e, next) =>
    renderBatchAnchor($, e, next, e.props.tool_use_id, sessionId),
  )

  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
    const first = e.props.calls[0]
    if (first === undefined) return next(e)
    return renderBatchAnchor($, e, next, first.tool_use_id, sessionId)
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
            onPress={() => setBatchExpanded($, sessionId, bId, false)}
          />
        ))}
      </Box>
    )
  })
}
