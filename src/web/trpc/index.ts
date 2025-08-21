import { router } from '@/web/trpc/trpc';
import { queueRouter } from './queue.trpc';
import { dashboardRouter } from './dashboard.trpc';

export const appRouter = router({
    queues: queueRouter,
    dashboard: dashboardRouter
});

export type AppRouter = typeof appRouter;