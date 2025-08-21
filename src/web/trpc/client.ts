import { QueryClient } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/web/trpc/index";
export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: process.env.BUN_PUBLIC_HOST || "" })],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
});