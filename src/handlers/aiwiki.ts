import type { Command, CommandContext } from "@/types/command";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const aiwiki: Command = {
    name: "aiwiki",
    enabled: process.env.ENABLE_AI_FEATURES === "true",
    description: "Cari informasi di Maimai Wiki dengan AI",
    usageExample: "`aiwiki lagu tersulit di maimai`",
    commandAvailableOn: "both",
    execute: async function (ctx: CommandContext): Promise<void> {
        const question = ctx.rawParams.trim();

        const openrouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    
        const { text: query } = await generateText({
            model: openrouter("google/gemini-2.0-flash-lite-001"),
            prompt: [
                `You are a query generator for a search engine.`,
                `Convert the following user question into a concise Google-style search query (as if someone is typing it into the search box).`,
                `Always return the query in english, irrespective of the user's question language`,
                `Question: ${question}`,
                ``,
                `Examples:`,
                `Input: Find me the information about the song "Pandora Paradoxx"`,
                `Output: "Pandora Paradoxx" song information`,
                ``,
                `Input: How do I reset my iPhone 12 to factory settings?`,
                `Output: reset iPhone 12 factory settings`,
                ``,
                `Now transform the question into a search query:`
            ].join("\n")
        });
      
        const queryResult = await searchMaimaiWiki(query);
    
        console.table(queryResult);
    
        const formattedResults = queryResult.map(result =>
            `- Text: ${result.text}\n`
        ).join('\n\n');
    
        const { text: result } = await generateText({
            model: openrouter("google/gemini-2.0-flash-001"),
            prompt: [
                `You are MaiBot, a bot that helps users find information about maimai.`,
                `User question: ${question}`,
                `Respond only in Indonesian, even if the question is in another language.`,
                ``,
                `You have access to the following markdown subset (for WhatsApp):`,
                `*bold*, _italic_, \`inline code\`,`,
                `1. ordered list,`,
                `- unordered list`,
                ``,
                `After looking at the wiki for maimai, you found this info:`,
                formattedResults,
                ``,
                `Answer the user’s question in Indonesian:`
            ].join("\n")
        });
    
        return result;
    }
}

export default aiwiki;