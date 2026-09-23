# Agent notes

Single-file OpenCode v2 plugin (`index.ts`) that adapts the published v1 plugin
`@bergetai/opencode-auth`. Keep it that way.

## Constraints

- Do not copy or port logic from `@bergetai/opencode-auth`. Call the v1 plugin function and
  translate its output. The only duplicated logic is `refresh`, which v1 does not export.
- Do not register a provider or models. OpenCode's models.dev catalog already defines
  `berget`; the adapter only contributes integration methods.
- OAuth method IDs are `oauth-<index>` in v1's method order. Stored credentials reference
  them, so never rename or reorder.
- Comments only for non-obvious intent. No doc-comment blocks.

## Verify a change

OpenCode hot-reloads the plugin when `index.ts` changes; `opencode service restart` for a
cold start.

```sh
bun run typecheck
opencode plugin list                       # berget.auth.v2-adapter, local
opencode api integration.get --param integrationID=berget --param directory=$PWD
opencode models | grep berget
```

Server log: `~/.local/share/opencode/log/opencode.log`. Look for `failed to load plugin`
and `level=ERROR`.

## Reference

- Migration guide: https://opencode.ai/v2/docs/build/plugins/migrate-v1
- Credential plumbing (not in the docs): `packages/core/src/model-resolver.ts` and
  `packages/core/src/integration.ts` in https://github.com/anomalyco/opencode at the tag
  matching `opencode --version`. `refresh` is called when a token is within 5 minutes of
  expiry; its return value is persisted.
