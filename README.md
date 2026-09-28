# opencode-berget-v2

Berget AI login for OpenCode v2.

> [!WARNING]
> Stopgap until Berget ships a v2 plugin. Not maintained long-term. Rely on it at your own
> risk.

## Why

[`@bergetai/opencode-auth`](https://github.com/berget-ai/opencode-berget-auth) targets the v1
plugin API and fails to load on v2:

```
Plugin must export a default definition with an id and an effect or setup function.
```

OpenCode v2 has the `berget` provider, its models and API key login built in. OAuth login is
missing.

## Install

```sh
opencode plugin add github:varvet/opencode-berget-v2
```

Then `/connect` in OpenCode, or `opencode auth login berget`.

Append `#<sha>` to pin a commit.

## How it works

`index.ts` calls the v1 plugin and registers its two OAuth methods (browser, device/QR) with
v2. v1 does the login. The adapter converts the result to a v2 credential.

Token refresh is reimplemented because v1 doesn't export it. It is a single `POST` to
`/v1/auth/refresh`, with none of v1's retries.

## Development

Clone, `bun install`, and add the path to `~/.config/opencode/opencode.json`:

```json
{ "plugins": ["/path/to/opencode-berget-v2"] }
```

OpenCode hot-reloads when `index.ts` changes.

```sh
bun run typecheck
```

`@opencode/plugin` must match `opencode --version`.
