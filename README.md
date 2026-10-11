# collapse-tool-use

A Claude Code mod that hides tool calls between agent messages behind one expandable button per turn, so your transcript reads as prose instead of tool noise.

## What it does

Every tool call in a turn renders as part of a batch keyed on the turn's id. The transcript shows:

```
> (5 tool calls made) click to expand
```

in place of the five rows. Press it, the batch expands with its full output and a `v (5 tool calls made) click to collapse` button at the top. A persistent `^ 5 collapse` button also appears in the band above the prompt for every currently-expanded batch, so you don't have to scroll back to collapse.

State is persisted via the plugin's `$.store`: toggle a batch, quit, resume the same session (`claude -r`) — the expand/collapse state and the batch mapping both come back. The global on/off (`/collapse`) persists across all sessions.

## Install

### As a dev-mod (hot-reload, no restart)

```bash
mkdir -p ~/.claude/dev-mods/$(uuidgen)
git clone https://github.com/danieltanfh95/collapse-tool-use ~/.claude/dev-mods/$(uuidgen)/collapse-tool-use
```

Claude Code's engine will ask once per session whether to enable hot-reload for that mods folder. Pick **Enable for this session**.

### As a one-shot

```bash
git clone https://github.com/danieltanfh95/collapse-tool-use
claude --plugin-dir ./collapse-tool-use
```

## Usage

- Default: new batches render collapsed with `> (N tool calls made) click to expand`.
- Press to expand. A `v (N tool calls made) click to collapse` sits above the batch; `^ N collapse` sits in the band above your prompt.
- `/collapse` toggles the whole mod on or off (default on). Persists across sessions.

## Development

Edit `hooks/register.tsx`. Hot-reload applies at the end of the turn where the edit lands — **but** that turn's own `turn.complete` still runs the old module, so any `turn.complete`-driven behaviour (like the `$.store` persistence) needs one more tool-call turn after the reload before it exercises.

```bash
claude plugin validate .
```

The engine lays its types next to the mod (`.claude-plugin/types/`) and a `tsconfig.json` the editor's project extends.

## License

MIT. See [LICENSE](LICENSE).
