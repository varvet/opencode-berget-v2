# opencode-berget-v2

Makes [`@bergetai/opencode-auth`](https://github.com/berget-ai/opencode-berget-auth) work on
OpenCode v2.

The published plugin targets the v1 plugin API and fails to load on v2:

```
Plugin must export a default definition with an id and an effect or setup function.
```

OpenCode's built-in catalog already defines the `berget` provider (base URL, models, API key
and `BERGET_API_KEY` methods). This adapter adds only what v2 lacks: it runs the v1 plugin and
registers its two OAuth login methods (browser PKCE, device/QR) as OpenCode v2 integration
methods, plus token refresh. OpenCode handles credential storage, Bearer injection and
persisting refreshed tokens.

## Install

```sh
opencode plugin add github:varvet/opencode-berget-v2
```

Pin a commit with `github:varvet/opencode-berget-v2#<sha>` if you prefer. Then `/connect` in
OpenCode or `opencode auth login berget`.

To work on it locally instead, clone it, run `bun install`, and put the clone's absolute path
in `~/.config/opencode/opencode.json`:

```json
{ "plugins": ["/path/to/opencode-berget-v2"] }
```

OpenCode hot-reloads the plugin when `index.ts` changes.

## Stopgap

Delete this once Berget ships a v2-native plugin and point `plugins` at their package instead.

## Development

```sh
bun run typecheck
```

`@opencode/plugin` must match the installed OpenCode version (`opencode --version`).
