import type { JSX } from "react";

export default function DashboardShell({children}: {children: React.ReactNode}) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>MaiBot WA Dashboard</title>
                <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
            </head>
            <body>
                <div id="dashboard-root">
                    {children}
                </div>
            </body>
        </html>
    );
}