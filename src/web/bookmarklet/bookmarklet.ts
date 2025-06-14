import { build, type BunRequest } from "bun";
import { join } from "path";
import { ingestData } from "./ingest";
import { Effect } from "effect";
import { replacePlaceholderPlugin } from "./bun-plugins";

export async function handleIngestRequest(req: BunRequest) {
    const body = await req.text();
    const totalRating = await Effect.runPromise(ingestData(body));

    return new Response(JSON.stringify({
        ok: true,
        data: totalRating
    }))
}

export async function handleBookmarkletIngestRequest(req: BunRequest) {

    const bearer = req.headers.get('Authorization')?.trim().substring(0,12) ?? "";
    
    const buildOutput = await build({
        minify: true,
        format: "iife",
        entrypoints: [
            join(__dirname, "entrypoint.ts")
        ],
        plugins: [
            replacePlaceholderPlugin("TOKEN", "abcascuiaiuas"),
            replacePlaceholderPlugin("HOST", process.env.HOST ?? ""),
        ]
    });

    return new Response(buildOutput.outputs[0], {
        headers: {
            "Access-Control-Allow-Origin": "https://maimaidx-eng.com",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}