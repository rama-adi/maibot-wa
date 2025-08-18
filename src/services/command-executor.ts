import { CommandExecutor } from "@/contracts/command-executor";
import { WhatsAppGatewayService, type WhatsAppGatewayPayload } from "@/contracts/whatsapp-gateway";
import { Effect, Layer } from "effect";

export const createCommandExecutor = (payload: WhatsAppGatewayPayload) => Layer.effect(CommandExecutor)(
    Effect.gen(function* () {
        const whatsapp = yield* WhatsAppGatewayService;

        return {
            reply: (message: string) => Effect.gen(function* () {
                if (
                    whatsapp.capabilities.includes('sendContextualReply')
                    && payload.messageId
                ) {
                    yield* whatsapp.sendReply({
                        messageId: payload.messageId,
                        to: payload.sender,
                        message: payload.group ? `@${payload.name}, ${message}` : message
                    });
                } else {
                    yield* whatsapp.sendMessage({
                        to: payload.sender,
                        message: payload.group ? `@${payload.name}, ${message}` : message
                    });
                }
            }),
        };
    })
);