import { Config, Effect, Redacted, Layer } from "effect";
import { buildURL } from "./utils/url";
import { WhatsAppGatewayService } from "./contracts/whatsapp-gateway";
import { WahaWSWhatsappService, wahaWSConfig } from "./services/wahaWS";
import { LiveRuntimeContainer } from "../container";
import { CommandRouterService } from "./contracts/command-router";
import { CommandRouterServiceLive } from "./services/command-router";
import { createCommandExecutor } from "./services/command-executor";
import { LockService } from "./contracts/lock";

// I'm using WAHA WS so I can test locally
// Technically, you could just change this implementation. All the contracts are there
export function bootstrapWhatsappWS() {
  const bootstrapEffect = Effect.gen(function* () {
    // Get configuration and build WebSocket URL
    const config = yield* wahaWSConfig;
    const url = yield* buildURL(config.wssUrl, {
      "x-api-key": Redacted.value(config.apiKey),
      "session": config.session,
      "events": "message"
    });

    // Program to handle incoming messages with command routing
    const program = (data: string) =>
      Effect.gen(function* () {
        const gateway = yield* WhatsAppGatewayService;
        const lockService = yield* LockService;

        // Parse the webhook to get WhatsApp payload
        const payload = yield* gateway.handleWebhook(data, new Headers());

        // If we have a valid payload, route it through the command system
        if (payload && payload.message) {
          // Create lock key using message ID to prevent spam/duplicate processing
          const lockKey = `message_lock:${payload.messageId}`;

          // Try to acquire lock with 5 minute expiry (300 seconds)
          const lockAcquired = yield* lockService.acquire(lockKey, {
            expiry: 300, // 5 minutes in seconds
            limit: 1
          });

          if (!lockAcquired) {
            // Message is already being processed or was recently processed
            return payload;
          }

          try {
            // Create command executor for this specific message
            const executorLayer = createCommandExecutor(payload);

            // Create router layer with all dependencies
            const routerWithDeps = Layer.provide(
              CommandRouterServiceLive,
              Layer.mergeAll(LiveRuntimeContainer, executorLayer)
            );

            // Load commands and handle the message
            yield* Effect.gen(function* () {
              const commandRouter = yield* CommandRouterService;
              yield* commandRouter.loadCommands();
              yield* commandRouter.handle(payload);
            }).pipe(Effect.provide(routerWithDeps));
          } finally {
            // Note: We don't release the lock immediately to prevent rapid re-processing
            // The lock will expire after 5 minutes automatically
          }
        }

        return payload;
      });

    // Create the base layer without CommandRouterService (it's created per-message)
    const baseLayer = Layer.mergeAll(LiveRuntimeContainer, WahaWSWhatsappService);

    // === Keepalive + Reconnect state ===
    let socket: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const PING_EVERY_MS = 10_000;
    const BASE_DELAY_MS = 1_000;        // 1s
    const MAX_DELAY_MS = 30_000;        // 30s
    const JITTER_MS = 500;

    const clearTimers = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      reconnectAttempts += 1;
      const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (reconnectAttempts - 1));
      const delay = exp + Math.floor(Math.random() * JITTER_MS);
      console.warn(`WebSocket: scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);
      reconnectTimer = setTimeout(connect, delay);
    };

    const startPinger = () => {
      // If the Node 'ws' client is used, it supports ping(). In browsers, it doesn't.
      pingInterval = setInterval(() => {
        if (!socket) return;
        if ((socket as any).readyState !== WebSocket.OPEN) return;

        try {
          if (typeof (socket as any).ping === "function") {
            // Node 'ws' ping frame
            (socket as any).ping();
          } else {
            // App-level ping message for browser-like environments
            socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          }
        } catch (err) {
          console.warn("WebSocket: ping failed, will trigger reconnect.", err);
          try { socket.close(); } catch {}
        }
      }, PING_EVERY_MS);
    };

    const connect = () => {
      clearTimers();

      // Create WebSocket
      socket = new WebSocket(url.toString());

      socket.addEventListener("open", () => {
        console.log("WebSocket connected successfully");
        reconnectAttempts = 0; // reset backoff on successful connect
        startPinger();
      });

      socket.addEventListener("message", async (event) => {
        try {
          await Effect.runPromise(program(event.data).pipe(Effect.provide(baseLayer)));
        } catch (error) {
          console.error("Error processing webhook:", error);
        }
      });

      socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        // Let 'close' drive the reconnect path; some envs don't emit close after error,
        // so we also schedule reconnect here defensively if the socket isn't OPEN.
        if (socket && socket.readyState !== WebSocket.OPEN) {
          scheduleReconnect();
        }
      });

      socket.addEventListener("close", (ev) => {
        console.log(`WebSocket connection closed (code=${ev.code}, reason=${ev.reason || "n/a"})`);
        clearTimers();
        scheduleReconnect();
      });
    };

    // Initial connect
    connect();

    // Return the current socket reference (will be replaced on reconnects)
    return socket!;
  });

  // Run the bootstrap effect and handle any errors
  Effect.runSync(
    bootstrapEffect.pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("Bootstrap failed:", error);
          process.exit(1);
        })
      )
    )
  );
}
