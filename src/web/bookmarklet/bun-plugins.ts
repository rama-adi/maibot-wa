import type { BunPlugin } from "bun";
import { readFile } from 'node:fs/promises';



function getLoader(filePath: string) {
    if (filePath.endsWith('.ts')) return 'ts';
    if (filePath.endsWith('.tsx')) return 'tsx';
    if (filePath.endsWith('.js')) return 'js';
    if (filePath.endsWith('.jsx')) return 'jsx';
    return 'text'; // Default loader
}

export const replacePlaceholderPlugin = (placeholder: string, value: string) => ({
    name: 'replace-placeholder',
    async setup(build) {
        // The onLoad function intercepts files that match the filter
        build.onLoad({ filter: /\.(js|ts|tsx)$/ }, async (args) => {

            // 1. Read the original file content
            const code = await readFile(args.path, 'utf8');

            // 2. Perform the replacement
            const transformedCode = code.replaceAll(`__${placeholder}__`, value);

            return {
                contents: transformedCode,
                loader: getLoader(args.path),
            };
        });
    },
} as BunPlugin);