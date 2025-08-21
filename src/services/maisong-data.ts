import type { API } from "@/contracts/api";
import { MaiSongData, MaiSongSearchError, MaiSongNetworkError, MaiSongValidationError } from "@/contracts/maisong-data";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Config, Effect, Layer } from "effect";

export const maisongDataConfig = Config.all({
    url: Config.string("MAISONG_DATA_URL")
})
    

export const MaisongDataLive = Layer.effect(MaiSongData)(
    Effect.gen(function* () {
        const config = yield* maisongDataConfig;
        const client = createTRPCClient<API>({
            links: [
                httpBatchLink({
                    url: config.url,
                }),
            ],
        });
        const classifyError = (error: unknown, operation: "byTitle" | "byMeta", input: string) => {
            if (error instanceof Error) {
                // Network-related errors
                if (error.message.includes('network') || error.message.includes('timeout') || 
                    error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
                    return new MaiSongNetworkError({
                        operation,
                        input,
                        cause: error,
                        message: `Network error during ${operation}: ${error.message}`
                    });
                }
                
                // Validation errors (400-level HTTP errors)
                if (error.message.includes('400') || error.message.includes('validation') || 
                    error.message.includes('invalid')) {
                    return new MaiSongValidationError({
                        operation,
                        input,
                        cause: error,
                        message: `Validation error during ${operation}: ${error.message}`
                    });
                }
                
                // Generic search error
                return new MaiSongSearchError({
                    operation,
                    input,
                    cause: error,
                    message: `Search error during ${operation}: ${error.message}`
                });
            }
            
            // Handle non-Error objects
            if (typeof error === 'object' && error !== null && 'message' in error) {
                return new MaiSongSearchError({
                    operation,
                    input,
                    cause: error,
                    message: `Search error during ${operation}: ${String(error.message)}`
                });
            }
            
            // Unknown error type
            return new MaiSongSearchError({
                operation,
                input,
                cause: error,
                message: `Unknown error during ${operation}: ${String(error)}`
            });
        };

        return {
            byTitle: (title) => 
                Effect.tryPromise({
                    try: () => client.songs.findByTitle.query({ title }),
                    catch: (error) => classifyError(error, "byTitle", `title: "${title}"`)
                }),
            byMeta: (meta) => 
                Effect.tryPromise({
                    try: () => client.songs.searchByMeta.query(meta),
                    catch: (error) => {
                        const metaDescription = Object.entries(meta)
                            .filter(([_, value]) => value !== null && value !== undefined)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ');
                        return classifyError(error, "byMeta", `meta: {${metaDescription}}`);
                    }
                })
        }
    }))