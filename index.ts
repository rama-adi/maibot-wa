import renderDashboard from "@/dashboard/render-dashboard";
import { setupLoggerOnce } from "@/services/logger";
import type { BunRequest } from "bun";



Bun.serve({
    routes: {
        "/dashboard/streams": async (req) => {
            if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
                return new Response(null, {
                    status: 401
                });
            }

            const stream = new ReadableStream({
                start(controller) {
                    setupLoggerOnce(controller);
                },
                cancel(controller: ReadableStreamDefaultController) {
                    controller.close();
                },
            });
            
            return new Response(stream, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/event-stream;charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
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
        }
    },
    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,
        // Echo console logs from the browser to the server
        console: true,
    },
});