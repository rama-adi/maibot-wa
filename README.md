# maibot-wa

maibot-wa is a rewrite of the maimai bot service for WhatsApp. The project fully embraces **WAHA** for the transport layer, **tRPC** for end-to-end type-safe APIs, and **Effect** for functional programming.

maimai song lookups are no longer handled here. Instead, song data is served by a separate service that can be updated independently.

## Features

- **WAHA integration** – connect to WhatsApp through WAHA.
- **tRPC API** – type-safe request/response contracts for internal and external clients.
- **Effect-based runtime** – composable, typed effects with dependency injection.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) 1.0+
- A running WAHA instance

### Installation

```bash
bun install
```

### Development

Start the HTTP server:

```bash
bun run index.ts
# or with hot reload
bun --hot index.ts
```

The server exposes `/trpc` endpoints.

## Status

This rewrite is a work in progress. Explore, modify, and extend as needed.
