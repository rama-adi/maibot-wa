import { Effect, Layer, Schema, ManagedRuntime } from "effect";
import { publicProcedure, router } from "./trpc";
import type { WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import type { CommandDeps } from "@/contracts/bot-command";
import { CommandRouterService } from "@/contracts/command-router";
import { CommandRouterServiceLive } from "@/services/command-router";
import { CommandExecutor } from "@/contracts/command-executor";
import { MaiSongData } from "@/contracts/maisong-data";
import { MaisongDataLive } from "@/services/maisong-data";
import { TRPCError } from "@trpc/server";
import { MaiAi } from "@/contracts/mai-ai";
import { MaiAiLive } from "@/services/mai-ai";

export const dashboardRouter = router({
    runCommand: publicProcedure
        .input(
            Schema.standardSchemaV1(Schema.Struct({
                message: Schema.String,
                group: Schema.optional(Schema.Boolean)
            }))
        )
        .mutation(async ({ input, ctx }) => {
            try {
                if (ctx.cookies.get("TOKEN") !== process.env.DASHBOARD_TOKEN) {
                    throw new TRPCError({
                        code: 'UNAUTHORIZED',
                        message: 'You are not authorized to test commands.',
                    });
                }

                const uuid = crypto.randomUUID()
                const payload = {
                    id: uuid,
                    sender: "000000000000",
                    messageId: uuid,
                    message: input.message,
                    group: input.group ?? false,
                    number: "dashboard",
                    name: "Dashboard User"
                } as WhatsAppGatewayPayload


                const replies: string[] = [];

                // Create a mock executor for dashboard use
                const mockExecutor = {
                    reply: (msg: string) => Effect.sync(() => { replies.push(msg); }),
                    replyImage: (imageURL: string, options?: { 
                        caption?: string; 
                        mime?: string; 
                        filename?: string; 
                    }) => Effect.sync(() => {
                        const caption = options?.caption ? `\n${options.caption}` : '';
                        replies.push(`![Image](${imageURL})${caption}`);
                    })
                };

                // Get the MaiSongData service from the runtime
                const getMaiSongData = Effect.gen(function* () {
                    return yield* MaiSongData;
                });

                const getMaiAi = Effect.gen(function* () {
                    return yield* MaiAi;
                });

                const maiSongDataResult = await ctx.effectRuntime.runPromise(getMaiSongData);
                const maiAiResult = await ctx.effectRuntime.runPromise(getMaiAi);

                // Create the router service with all dependencies provided
                const mockExecutorLayer = Layer.succeed(CommandExecutor, mockExecutor);
                const maiSongDataLayer = Layer.succeed(MaiSongData, maiSongDataResult);
                const maiAiLayer = Layer.succeed(MaiAi, maiAiResult);
                const dependenciesLayer = Layer.mergeAll(mockExecutorLayer, maiSongDataLayer, maiAiLayer);
                const routerLayer = Layer.provide(CommandRouterServiceLive, dependenciesLayer);

                const program = Effect.gen(function* () {
                    const routerSvc = yield* CommandRouterService;

                    const deps: CommandDeps = {
                        executor: mockExecutor,
                        maiAi: maiAiResult,
                        maiSongData: maiSongDataResult
                    };

                    if(payload.group) {
                        yield* deps.executor.reply("➡️ Group (ID Will be quoted)");
                    }

                    yield* routerSvc.loadCommandsWithDeps(deps);
                    yield* routerSvc.handleWithDeps(payload, deps);
                   
                    return replies;
                });

                const standaloneRuntime = ManagedRuntime.make(routerLayer);
                try {
                    const out = await standaloneRuntime.runPromise(program);
                    return { replies: out };
                } catch (error) {
                    console.error("Error running command:", error);
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to execute command',
                        cause: error
                    });
                } finally {
                    standaloneRuntime.dispose();
                }
            } catch (error) {
                console.error("Dashboard runCommand error:", error);
                
                // Re-throw TRPC errors as-is
                if (error instanceof TRPCError) {
                    throw error;
                }
                
                // Wrap other errors in a TRPC error
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred',
                    cause: error
                });
            }
        }),
})