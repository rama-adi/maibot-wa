import { WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { Context, Effect, Layer } from "effect";
import { RateLimiterService } from "@/services/rate-limiter";
import { findUserByPhone } from "@/database/queries/user-query";

export class CommandExecutor extends Context.Tag("CommandExecutor")<
    CommandExecutor,
    {
        reply: (message: string) => Effect.Effect<void, Error>;
    }
>() { }

// Factory function to create a payload-specific CommandExecutor
export const createCommandExecutor = (payload: WhatsAppGatewayPayload) => Layer.effect(CommandExecutor)(
    Effect.gen(function* () {
        const whatsapp = yield* WhatsAppGatewayService;
        const rateLimiter = yield* RateLimiterService;

        return {
            reply: (message: string) => Effect.gen(function* () {
                // Check rate limit before sending
                const canSend = yield* rateLimiter.canSend(payload.sender);

                if (!canSend) {
                    // Return without sending if rate limited
                    return Effect.void;
                }

                const user = yield* Effect.promise(() => findUserByPhone(payload));

                if (
                    whatsapp.capabilities.includes('sendContextualReply')
                    && payload.messageId
                ) {
                    yield* whatsapp.sendReply({
                        messageId: payload.messageId,
                        to: payload.sender,
                        message: payload.group ? `${user.name}, ${message}` : message
                    });
                } else {
                    yield* whatsapp.sendMessage({
                        to: payload.sender,
                        message: payload.group ? `${user.name}, ${message}` : message
                    });
                }

                // Record the message after successful send
                yield* rateLimiter.recordMessage(payload.sender);
            }),
        };
    })
);
