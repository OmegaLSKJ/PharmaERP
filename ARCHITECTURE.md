# PharmaERP platform structure

- `src/` remains the current, working Vite application and feature tree.
- `apps/web/` is the Next.js host for the same feature tree during the web-platform migration.
- `apps/mobile/` is an Expo starter focused on field operations, not a compressed desktop ERP.
- `packages/domain/` holds shared ERP contracts and API types.
- `packages/design-tokens/` holds platform-neutral visual tokens.

The web and mobile clients must use the same authenticated ERP API. Share domain rules, validation, permissions and API contracts; keep dense desktop tables and mobile task flows as distinct UI implementations.
