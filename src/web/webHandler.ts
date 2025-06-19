import { cleanupController, setupLoggerOnce } from "@/services/logger";
import type { BunRequest } from "bun";
import renderDashboard from "@/web/dashboard/render-dashboard";
import { CommandRouter } from "@/services/command-router";
import { handleBookmarkletIngestRequest, handleIngestRequest } from "./bookmarklet/bookmarklet";
import renderCommandPage from "./dashboard/command-page";
import renderUsersPage from "./dashboard/list-users";
import { Effect, Layer } from "effect";
import { CommandRouterService, CommandRouterServiceLive } from "@/services/effect-command-router";
import { WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import { NullRateLimiterService } from "@/services/rate-limiter";

export const webHandler = {
    "/": async (req: BunRequest) => {
        return new Response("Bot running!");
    },
    "/dashboard/streams": async (req: BunRequest) => {
        if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
            return new Response(null, {
                status: 401
            });
        }

        let controller: ReadableStreamDefaultController<any>;
        let isClosed = false;
        let heartbeatInterval: Timer;

        const stream = new ReadableStream({
            start(ctrl) {
                controller = ctrl;
                try {
                    setupLoggerOnce(controller);

                    // Set up heartbeat to keep connection alive
                    heartbeatInterval = setInterval(() => {
                        try {
                            if (!isClosed && controller) {
                                controller.enqueue(`: heartbeat ${Date.now()}\n\n`);
                            } else {
                                clearInterval(heartbeatInterval);
                            }
                        } catch (error) {
                            console.error('Heartbeat failed:', error);
                            clearInterval(heartbeatInterval);
                            isClosed = true;
                        }
                    }, 8000); // Every 8 seconds (under Bun's 10s timeout)

                } catch (error) {
                    console.error('Error setting up logger:', error);
                    if (!isClosed) {
                        controller.error(error);
                    }
                }
            },
            cancel() {
                // Mark as closed and clean up
                isClosed = true;
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
                if (controller) {
                    cleanupController(controller);
                }
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/event-stream;charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    },
    "/dashboard": {
        async GET(req: BunRequest) {
            return await renderDashboard(req)
        },

        async POST(req: BunRequest) {
            const formData = await req.formData();
            const key = formData.get("key")?.toString() ?? "";

            if (key === process.env.DASHBOARD_KEY) {
                return new Response(null, {
                    status: 302,
                    headers: {
                        "Location": "/dashboard",
                        "Set-Cookie": `DASH_COOKIE=${key}; Path=/; HttpOnly; SameSite=Strict`
                    }
                });
            }

            return new Response(null, {
                status: 302,
                headers: {
                    "Location": "/dashboard"
                }
            });
        }
    },
    "/dashboard/command": {
        async GET(req: BunRequest) {
            return await renderCommandPage(req);
        },
        async POST(req: BunRequest) {

        
            if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
                return new Response(null, {
                    status: 401
                });
            }

            const formData = await req.formData();
            const command = formData.get("command")?.toString() ?? "";

            if (command === "") {
                return Response.json({
                    result: "Empty command!"
                });
            }
            let result = "";
            const FakeWhatsAppGatewayService = Layer.succeed(
                WhatsAppGatewayService,
                {
                    capabilities: ["sendMessage", "sendContextualReply"],
                    handleWebhook: (data: string) => Effect.succeed({
                        sender: "INTERNAL_ADMIN",
                        messageId: "123",
                        message: data,
                        group: false,
                        number: "INTERNAL_ADMIN",
                        name: "Tester Admin Account"
                    }),
                    sendMessage: (data: { to: string, message: string }) =>
                        Effect.gen(function* () {
                            result = "---MSG SENT:\n\n" + data.message;
                            return "";
                        }),
                    sendReply: (data: { to: string, messageId: string, message: string }) =>
                        Effect.gen(function* () {
                            result = "---REPLIED:\n\n" + data.message;
                            return "";
                        })
                }
            );

            const MainLayer = Layer.mergeAll(
                FakeWhatsAppGatewayService,
                NullRateLimiterService,
                CommandRouterServiceLive
            );

            try {
                // Execute the command using the Effect system (following the usage example pattern)
                const program = Effect.gen(function* () {
                    const router = yield* CommandRouterService;

                    // Load commands
                    yield* router.loadCommands();

                    // Handle the command
                    yield* router.handle({
                        sender: "INTERNAL_ADMIN",
                        messageId: "123",
                        message: command,
                        group: false,
                        number: "INTERNAL_ADMIN",
                        name: "Tester Admin Account"
                    });
                });

                // Run the program with the layer
                await Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
                return Response.json({ result: result || "Command executed successfully (no output)" });
            } catch (error) {
                console.error("Command execution failed:", error);
                return Response.json({
                    result: `❌ Command failed: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
    },
    "/bookmarklet": {
        async GET(req: BunRequest) {
            return new Response("amogus");
        },
        async POST(req: BunRequest) {
            return await handleBookmarkletIngestRequest(req);
        }
    },
    "/bookmarklet/ingest": {
        async POST(req: BunRequest) {
            return await handleIngestRequest(req);
        }
    },
    "/dashboard/users": {
        async GET(req: BunRequest) {
            return await renderUsersPage(req);
        }
    }
};