import { MaiAi } from "@/contracts/mai-ai";
import { Data, Effect, JSONSchema, Layer, Schema } from "effect";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { generateText, hasToolCall, stepCountIs, tool } from 'ai';
import { MaiSongData } from "@/contracts/maisong-data";
import { z } from "zod/v4";
import vm from 'node:vm';
import * as jq from "node-jq";

class MaiAiError extends Data.TaggedError("MaiAiError")<{
    readonly message: string
    readonly cause?: unknown
}> { }


export const MaiAiLive = Layer.effect(MaiAi)(
    Effect.gen(function* () {
        const maiData = yield* MaiSongData;

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const groq = createGroq({
            apiKey: process.env.GROQ_API_KEY
        });

        const MODEL_JQ = groq("moonshotai/kimi-k2-instruct");
        //const MODEL_MAIN = groq("qwen/qwen3-32b");
        const MODEL_MAIN = openai("gpt-5-mini");


        const tools = {
            searchSong: tool({
                description: "Search for mai mai songs by metadata filters like artist, level, BPM, etc.",
                inputSchema: z.object({
                    query: z.string().describe('Search query in english. MUST be included. FULL search query so correct result is displayed.'),
                    meta: z.object({
                        artist: z.string().optional().describe("Artist name"),

                        minLevel: z.float32().min(1.0).max(15.0).optional().describe("Minimum difficulty level (9.0, 11.5, etc). If the user uses dot notation use this"),
                        maxLevel: z.float32().min(1.0).max(15.0).optional().describe("Maximum difficulty level (9.0, 11.5, etc). If the user uses dot notation use this"),
                        minBpm: z.number().optional().describe("Minimum BPM"),
                        maxBpm: z.number().optional().describe("Maximum BPM"),
                        category: z.string().optional().describe("Song category"),
                        isUtage: z.boolean().optional().describe("Is utage chart"),
                        //type: z.string().optional().describe("Chart type"),
                        difficulty: z.enum(['basic', 'advanced', 'expert', 'master', 'remaster']).optional().describe("Difficulty name"),
                        noteDesigner: z.string().optional().describe("Note designer"),
                        isSpecial: z.boolean().optional().describe("Is special chart"),
                    })
                }),
                execute: async (input, opts) => {
                    try {
                        console.log("Searching ", input);
                        const result = await Effect.runPromise(maiData.byMeta(input.meta));
                        console.log("Search result structure:", {
                            resultType: Array.isArray(result) ? 'array' : 'object',
                            resultLength: Array.isArray(result) ? result.length : 'N/A',
                            firstItem: Array.isArray(result) && result.length > 0 ? {
                                hasPrimary: !!result[0]?.primary,
                                primaryTitle: result[0]?.primary?.title,
                                primaryArtist: result[0]?.primary?.artist,
                                utagesCount: result[0]?.utages?.length || 0
                            } : 'No items'
                        });

                        const baseSystemPrompt = [
                            "You are JqAI — an assistant specialized in writing efficient jq filters for JSON data processing.",
                            "Write ONLY a jq filter expression that processes the input data and formats the output.",
                            "Return the jq filter as a plain string without any markdown fences or explanations.",
                            "Do NOT include 'jq' command or quotes around the filter - just the filter expression itself.",

                            "",
                            "CRITICAL OUTPUT RULES:",
                            "- Your filter MUST NOT return empty arrays [] or null values.",
                            "- If no data matches, return a helpful message string instead.",
                            "- Output a SINGLE flat list of human-readable strings (one line per chart).",
                            "- Do NOT return arrays of arrays. Avoid wrapping intermediate results in [] unless at the very end for empty-check.",
                            "- Do not output JSON objects.",

                            "",
                            "ALWAYS include these essential fields in every output line:",
                            "- Song name: .title",
                            "- Artist: .artist",
                            "- Difficulty: .sheets[].difficulty",
                            "- Display Level: .sheets[].level",

                            "",
                            "LEVEL SELECTION (do not confuse):",
                            "- .level (Display Level) is a string like \"10+\" (shown in arcade).",
                            "- .internalLevel (Internal Level) is a decimal-like string such as \"14.5\".",
                            "- ONLY use .internalLevel when the search query itself specifies a decimal/comma notation (e.g., 13.9, 14.5).",
                            "- Otherwise, default to .level for filtering and output.",
                            "- Never mix them up.",

                            "",
                            "FLATTEN-FIRST PATTERN (required):",
                            "- Stream items with parentheses, not arrays: use (.primary, .utages[]?) to produce one Song at a time.",
                            "- Then stream sheets with . as $s | $s.sheets[] to produce one chart line per sheet.",
                            "- Collect ONCE at the very end only to check emptiness, then expand.",
                            "- Always use ascii_downcase when filtering text.",

                            "",
                            "CANONICAL SKELETON (copy this shape):",
                            "( [ .[]",
                            "    | (.primary, .utages[]?)",
                            "    | <optional select(...) filters>",
                            "    | . as $s",
                            "    | $s.sheets[]",
                            "    | \"\\($s.title) - \\($s.artist) [\\(.difficulty) \\(.level)]\"",
                            "] ) as $out",
                            "| if ($out|length) > 0 then $out[] else \"No songs found matching criteria\" end",

                            "",
                            "FILTERING GUIDELINES:",
                            "- Use select() with ascii_downcase for case-insensitive matches.",
                            "- Be MINIMAL and EFFICIENT — only touch fields you need for the filter/output.",
                            "- If filtering by internal level (decimal in query), use .sheets[]?.internalLevel in select() and include it in the output if helpful.",
                            "- Otherwise, filter by .sheets[]?.level.",
                            "- Prefer contains() for partial text matches; use == for exact matches.",

                            "",
                            "Input data structure:",
                            "ALWAYS an array: [SearchResult, SearchResult, ...] where SearchResult = { \"primary\": Song, \"utages\": [Song] }",
                            "Song: { \"title\": string, \"artist\": string, \"bpm\": number, \"sheets\": [Sheet] }",
                            "Sheet: { \"difficulty\": string, \"level\": string, \"levelValue\": number, \"internalLevel\": string, \"noteDesigner\": string }",

                            "",
                            "Examples (follow the canonical skeleton):",
                            "- All songs:",
                            "( [ .[] | (.primary, .utages[]?) | . as $s | $s.sheets[] | \"\\($s.title) - \\($s.artist) [\\(.difficulty) \\(.level)]\" ] ) as $out",
                            "| if ($out|length)>0 then $out[] else \"No songs found\" end",

                            "- By artist (e.g., Laur):",
                            "( [ .[] | (.primary, .utages[]?)",
                            "    | select(.artist | ascii_downcase | contains(\"laur\"))",
                            "    | . as $s | $s.sheets[]",
                            "    | \"\\($s.title) - \\($s.artist) [\\(.difficulty) \\(.level)]\"",
                            "] ) as $out",
                            "| if ($out|length)>0 then $out[] else \"No songs found by Laur\" end",

                            "- By display level (e.g., 10+):",
                            "( [ .[] | (.primary, .utages[]?)",
                            "    | . as $s | $s.sheets[]",
                            "    | select(.level == \"10+\")",
                            "    | \"\\($s.title) - \\($s.artist) [\\(.difficulty) \\(.level)]\"",
                            "] ) as $out",
                            "| if ($out|length)>0 then $out[] else \"No songs found with level 10+\" end",

                            "- By internal level (e.g., 14.9 — decimal in query):",
                            "( [ .[] | (.primary, .utages[]?)",
                            "    | . as $s | $s.sheets[]",
                            "    | select(.internalLevel == \"14.9\")",
                            "    | \"\\($s.title) - \\($s.artist) [\\(.difficulty) Internal \\(.internalLevel)]\"",
                            "] ) as $out",
                            "| if ($out|length)>0 then $out[] else \"No songs found with internal level 14.9\" end",

                            "- By note designer contains \"luxizhel\":",
                            "( [ .[] | (.primary, .utages[]?)",
                            "    | . as $s | $s.sheets[]",
                            "    | select(.noteDesigner and (.noteDesigner | ascii_downcase | contains(\"luxizhel\")))",
                            "    | \"\\($s.title) - \\($s.artist) [\\(.difficulty) \\(.level)] (\\(.noteDesigner))\"",
                            "] ) as $out",
                            "| if ($out|length)>0 then $out[] else \"No songs found by note designer containing \\\"luxizhel\\\"\" end"
                        ].join("\\n");



                        const unwrapCodeFences = (s: string) => {
                            if (!s) return "";
                            const m = s.match(/^\s*```(?:\w+)?\s*([\s\S]*?)\s*```\s*$/);
                            return m && m[1] ? m[1].trim() : s.trim();
                        };

                        const executeJqWithRetry = async (prompt: string, maxRetries = 5): Promise<any> => {
                            let lastError: Error | null = null;
                            let currentPrompt = prompt;

                            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                                console.log(`Attempt ${attempt}/${maxRetries} - Generating jq filter...`);

                                const { text: rawModelText } = await generateText({
                                    model: MODEL_JQ,
                                    system: baseSystemPrompt,
                                    prompt: currentPrompt,
                                    abortSignal: opts.abortSignal
                                });
                                console.log(`Attempt ${attempt} - Raw model text:`, rawModelText);

                                let jqFilter = unwrapCodeFences(rawModelText);
                                console.log(`Attempt ${attempt} - JQ filter after unwrapping:`, jqFilter);

                                // Basic validation of jq filter
                                if (!jqFilter || jqFilter.trim().length === 0) {
                                    console.log(`Attempt ${attempt} - Empty jq filter, treating as error`);

                                    if (attempt < maxRetries) {
                                        currentPrompt = [
                                            `Search query: ${input.query}`,
                                            "",
                                            `Previous attempt failed because no jq filter was provided.`,
                                            "",
                                            "Please provide a valid jq filter expression to process the data and format the output for this query."
                                        ].join("\n");
                                        console.log(`Attempt ${attempt} - Will retry with empty filter feedback`);
                                        continue;
                                    } else {
                                        break;
                                    }
                                }

                                try {
                                    console.log(`Attempt ${attempt} - Running jq filter:`, jqFilter);
                                    console.log(`Attempt ${attempt} - Data structure:`, {
                                        isArray: Array.isArray(result),
                                        type: typeof result,
                                        keys: result && typeof result === 'object' ? Object.keys(result) : 'N/A'
                                    });

                                    // Execute jq filter
                                    const jqResult = await jq.run(jqFilter, JSON.stringify(result), { input: 'string' });
                                    console.log(`Attempt ${attempt} - JQ execution SUCCESS:`, jqResult);

                                    // Check for empty arrays or null results (error case)
                                    const isEmptyResult = Array.isArray(jqResult) && jqResult.length === 0;
                                    const isNullResult = jqResult === null || jqResult === undefined;
                                    const isEmptyString = typeof jqResult === 'string' && jqResult.trim().length === 0;

                                    // Check for string containing only empty arrays like "[]\\n[]\\n[]"
                                    const isEmptyArraysString = typeof jqResult === 'string' &&
                                        jqResult.trim().split('\n').every(line => line.trim() === '[]');

                                    if (isEmptyResult || isNullResult || isEmptyString || isEmptyArraysString) {
                                        const errorMsg = `JQ filter returned empty result (${Array.isArray(jqResult) ? 'empty array' :
                                            isEmptyArraysString ? 'multiple empty arrays' :
                                                typeof jqResult
                                            })`;
                                        console.log(`Attempt ${attempt} - ${errorMsg}, treating as error`);
                                        throw new Error(errorMsg);
                                    }

                                    // Format the result
                                    if (Array.isArray(jqResult)) {
                                        // Filter out any empty strings or null values from the array
                                        const filteredResult = jqResult.filter(item =>
                                            item !== null && item !== undefined &&
                                            (typeof item !== 'string' || item.trim().length > 0)
                                        );

                                        if (filteredResult.length === 0) {
                                            throw new Error("JQ filter returned array with only empty/null values");
                                        }

                                        return { result: filteredResult.join('\n') };
                                    } else if (typeof jqResult === 'string') {
                                        return { result: jqResult };
                                    } else {
                                        return { result: JSON.stringify(jqResult) };
                                    }

                                } catch (jqError) {
                                    lastError = jqError as Error;
                                    console.error(`Attempt ${attempt} - JQ execution error:`, jqError, "Filter was:", jqFilter);

                                    if (attempt < maxRetries) {
                                        // Prepare error feedback for next attempt
                                        const errorMessage = jqError instanceof Error ? jqError.message : String(jqError);
                                        const dataStructureInfo = `Data is ${Array.isArray(result) ? 'an array' : 'an object'} with keys: ${result && typeof result === 'object' ? Object.keys(result).join(', ') : 'N/A'}`;

                                        currentPrompt = [
                                            `Search query: ${input.query}`,
                                            "",
                                            `Previous attempt failed with jq error: ${errorMessage}`,
                                            "",
                                            `Data structure: ${dataStructureInfo}`,
                                            "",
                                            "The failing jq filter was:",
                                            jqFilter,
                                            "",
                                            "Please fix the jq filter to avoid this error. Remember that the input is ALWAYS an array, so start with .[] to process each search result."
                                        ].join("\n");
                                        console.log(`Attempt ${attempt} - Will retry with jq error feedback`);
                                    }
                                }
                            }
                            // All attempts failed, use fallback
                            console.log("All jq generation attempts failed, using fallback result");

                            // Format fallback result with only essential fields
                            const fallbackFormatted = Array.isArray(result) ? result.map(item => {
                                const songs: string[] = [];

                                // Add primary song if exists
                                if (item.primary) {
                                    item.primary.sheets.forEach(sheet => {
                                        songs.push(`${item.primary.title} - ${item.primary.artist} [${sheet.difficulty} ${sheet.level}]${sheet.noteDesigner ? ` (${sheet.noteDesigner})` : ''}`);
                                    });
                                }

                                // Add utage songs if exist
                                if (item.utages && Array.isArray(item.utages)) {
                                    item.utages.forEach(utage => {
                                        utage.sheets.forEach(sheet => {
                                            songs.push(`${utage.title} - ${utage.artist} [${sheet.difficulty} ${sheet.level}]${sheet.noteDesigner ? ` (${sheet.noteDesigner})` : ''}`);
                                        });
                                    });
                                }

                                return songs;
                            }).flat().join('\n') : 'No results found';

                            return { result: fallbackFormatted };
                        };

                        const initialPrompt = `Search query: ${input.query}\n\nWrite a MINIMAL and EFFICIENT jq filter that extracts and formats only the specific data fields needed to answer this query.\n\nBe selective - only process the fields that are actually relevant to answering "${input.query}".`;
                        const jqResult = await executeJqWithRetry(initialPrompt);

                        return {
                            query: input.query,
                            result: jqResult
                        }

                    } catch (error) {
                        console.error("Step ERROR - Failed to search songs:", error);
                        return { error: "Failed to search songs", details: String(error) };
                    }
                }
            })
        };

        return {
            infer: (prompt) => Effect.gen(function* () {

                const systemPrompt = [
                    "Anda adalah *MAI.ai* — asisten ramah dan ahli untuk permainan ritme maimai (SEGA).",
                    "Tujuan: jawaban akurat, jelas, dan mudah dipahami semua level pemain.",
                    "Gaya: Bahasa Indonesia santai-informatif; gunakan bullet/nomor bila cocok.",
                    "Jika pertanyaan kurang jelas, tanya balik singkat.",
                    "Jika tidak yakin, katakan jujur + info tambahan yang dibutuhkan.",
                    "",
                    "- User mungkin bertanya mengenai 'pembuat lagu' atau 'karya', ini maksudnya artist, kecuali user spesifik meminta 'charter', ini maksudnya notes designer. cari di salah satu saja sesuai permintaan",
                    "- Contoh: 'lagu karya kanaria' -> 'artist: kanaria', 'lagu yang dichart luxizhel' -> 'notes designer: luxizhel'.",
                    "- Ingat selalu kecuali user meminta secara spesifik charter/notes designer, 'pembuat' selalu merujuk ke artis saja.",
                    "Markdown WhatsApp yang bisa dipakai:",
                    "- *teks* = bold",
                    "- _teks_ = italic",
                    "- ~teks~ = strikethrough",
                    "- `teks` = inline code",
                    "- ```teks``` = monospace",
                    "- * / - = bullet list",
                    "- 1. 2. 3. = numbered list",
                    "- > teks = quote",
                    "",
                    "Tabel, dll tidak di support oleh whatsapp",
                    "Level di maimai ada: 1-15 (dengan level + dari level 7, sehingga ada 7+, 8+, ini duduk diantara level n dan n+1)",
                    "Jadi misal: 7, 7+, 8, dst.. (Level display).",
                    "Level terkecil: 1, terbesar: 15 (1.0 - 15.0)",
                    "Bila user bertanya tentang lagu maimai, harus gunakan searchSong, jangan menjawab dari memori.",

                    "Tentang *chart maimai*: ada 2 cara penyebutan level:",
                    "- *Display*: level di mesin (contoh: 9, 10+) → mudah dilihat di arcade.",
                    "- *Internal*: level teknis pakai koma (contoh: 13.9, 14.5) → dipakai untuk bedakan tingkat kesulitan yang detail.",
                    "- Misal user mungkin bertanya tentang level 13, dia berbicara tentang level display, 13.5, internal",
                ].join("\n");


                const result = yield* Effect.catchAll(
                    Effect.tryPromise({
                        try: async (signal) => {
                            console.log("Calling generateText with prompt:", prompt);
                            const response = await generateText({
                                model: MODEL_MAIN,
                                system: systemPrompt,
                                prompt,
                                tools,
                                stopWhen: stepCountIs(5),
                                abortSignal: signal,
                            });
                            return response;
                        },
                        catch: (cause) => {
                            console.error("GenerateText error:", cause);
                            return new MaiAiError({
                                message: "Gagal memanggil MAI.ai",
                                cause
                            });
                        }
                    }),
                    (error: MaiAiError) =>
                        Effect.gen(function* () {
                            const message = `Maaf, terjadi kendala saat menghubungi MAI.ai: ${error.message}`;
                            console.log("Error", error.cause);
                            return message;
                        })
                );

                if (typeof result === 'string') {
                    return result;
                }

                return result.text;
            })
        }
    })
)