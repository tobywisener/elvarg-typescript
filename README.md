# elvarg-typescript

A browser-based Old School RuneScape private server combining the
[xRSPS](https://github.com/xrsps/xrsps-typescript) TypeScript/WebGL client with
the [Elvarg](https://github.com/RSPSApp/elvarg-rsps) server, ported to TypeScript.

## Credits

This project builds on the work of both upstream communities:

- [xRSPS](https://github.com/xrsps/xrsps-typescript) provides the browser client,
  cache tooling, and the foundation of this repository.
- [Elvarg](https://github.com/RSPSApp/elvarg-rsps) provides the game-server
  foundation.
- [`elvarg-web-server`](https://github.com/tobywisener/elvarg-web-server) is the
  TypeScript server port used in this fork.

## Packages

- [`client/`](client/) — the `@xrsps/client` browser application
- [`server/`](server/) — the TypeScript Elvarg game server
- [`docs/`](docs/) — the xRSPS documentation site

## Requirements

- Node.js 22.16 or newer
- Corepack, included with Node.js 22

The root, client, and server all use the repository-pinned Yarn 4.12.0. A
separate global Yarn installation is not required.

## Quick start

```bash
git clone https://github.com/tobywisener/elvarg-typescript.git
cd elvarg-typescript
corepack enable
yarn setup
yarn start
```

`yarn setup` installs the root tools, Elvarg server, and browser client. It is
safe to run again after pulling changes. `yarn start` launches both processes;
the client is normally available at <http://localhost:3000>.

The first start downloads the OSRS cache from the OpenRS2 Archive. The selected
cache is recorded in [`server/target.txt`](server/target.txt).

## Publish your world

1. Register or sign in at [RSPS.app](https://rsps.app/public/), then open **Settings → Server tokens**.
2. Click **Create server token** and copy it immediately; it is only shown once.
3. Create `.env` in the repository root:

```dotenv
WEBRTC_WORLD_ID=my-world
WEBRTC_WORLD_TOKEN=paste-your-token-here
```

`WEBRTC_WORLD_ID` is both the unique ID and the name players see. It may contain letters, numbers, `.`, `_` or `-`. To show a friendlier name, optionally add `WEBRTC_WORLD_NAME="My World"`.

Run `yarn start`. When the server logs `registered world my-world with signalling relay`, it will appear automatically in every client's world list. The public relay and STUN server are already configured, so most home connections need no port forwarding; restrictive NATs may still require TURN.

Keep the token private. `.env` is ignored by Git, and tokens can be revoked from the same forum settings page.

## Commands

| Command | Purpose |
| --- | --- |
| `yarn setup` | Install root, server, and client dependencies |
| `yarn start` | Start the Elvarg server and browser client together |
| `yarn server` | Start only the Elvarg server |
| `yarn client` | Start only the browser client |
| `cd server && yarn ensure-cache` | Download or verify the selected OSRS cache |
| `cd client && yarn test` | Run the client regression tests |
| `cd client && yarn typecheck` | Type-check the client |

### Recovering an older or interrupted install

Normally, rerunning `yarn setup` is enough. If an older checkout left
incompatible dependencies behind, remove only the dependency directories and
run setup again.

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules, client/node_modules, server/node_modules -ErrorAction SilentlyContinue
yarn setup
```

macOS/Linux:

```bash
rm -rf node_modules client/node_modules server/node_modules
yarn setup
```

Game caches, configuration, and player saves are not removed by either command.

## Deploying the client

Run `yarn deploy` from `client/` to build and upload `client/build/` to
`/public_html/play` over explicit FTPS, with an upload progress bar. FTP settings
come from the git-ignored `client/.env`; see `client/.env.example` for the keys.
Existing remote files are retained and `index.html` is published last.

Use `yarn deploy --dry-run` to validate configuration and build without uploading.

## Maintaining this fork

The server is imported from the `xrsps` branch of `elvarg-web-server` with its
history preserved. Configure the repository's existing merge driver once per
clone before merging xRSPS client updates:

```bash
git config merge.ours.driver true
```

To import newer Elvarg server changes:

```bash
git fetch elvarg xrsps
git subtree pull --prefix=server elvarg xrsps -m "Update server/ from elvarg-web-server"
```

## Legal

This is a fan project. It is not affiliated with, endorsed by, or connected to
Jagex Ltd. Old School RuneScape and related assets and trademarks belong to
their respective owners.
