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
                        message: message
                    });
                } else {
                    yield* whatsapp.sendMessage({
                        to: payload.sender,
                        message: payload.group ? `@${payload.name}, ${message}` : message
                    });
                }
            }),
            replyImage: (imageURL: string, options?: { 
                caption?: string; 
                mime?: string; 
                filename?: string; 
            }) => Effect.gen(function* () {
                if (!whatsapp.capabilities.includes('sendImage')) {
                    return yield* Effect.fail(new Error('WhatsApp gateway does not support image sending'));
                }

                if (
                    whatsapp.capabilities.includes('sendContextualReply')
                    && payload.messageId
                ) {
                    yield* whatsapp.sendImageReply({
                        messageId: payload.messageId,
                        to: payload.sender,
                        imageURL,
                        caption: options?.caption,
                        mime: options?.mime || 'image/jpeg',
                        filename: options?.filename || 'image.jpg'
                    });
                } else {
                    const caption = options?.caption 
                        ? (payload.group ? `@${payload.name}, ${options.caption}` : options.caption)
                        : undefined;

                    yield* whatsapp.sendImage({
                        to: payload.sender,
                        imageURL,
                        caption,
                        mime: options?.mime || 'image/jpeg',
                        filename: options?.filename || 'image.jpg'
                    });
                }
            }),
        };
    })
);