import { renderToReadableStream } from "react-dom/server";
import DashboardShell from "./shell";
import renderLoginPage from "./login";

export default async function renderCommandPage(req: Bun.BunRequest) {
    if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
        return await renderLoginPage();
    }

    return new Response(
        await renderToReadableStream(
            <DashboardShell>
                <div className="min-h-screen bg-gray-50 p-6">
                    <div className="max-w-xl mx-auto space-y-4">
                        <h1 className="text-2xl font-bold text-gray-900">Command Tester</h1>
                        <form id="command-form" className="flex gap-2">
                            <input id="command-input" type="text" className="flex-1 border rounded px-3 py-2" placeholder="Enter command" />
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Run</button>
                        </form>
                        <pre id="command-output" className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap"></pre>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                        document.getElementById('command-form').addEventListener('submit', async function(e) {
                            e.preventDefault();
                            const input = (document.getElementById('command-input') as HTMLInputElement).value;
                            const formData = new FormData();
                            formData.append('command', input);
                            const res = await fetch('/dashboard/command', { method: 'POST', body: formData });
                            const data = await res.json();
                            document.getElementById('command-output').textContent = data.result || 'No response';
                        });
                    `
                }} />
            </DashboardShell>
        ),
        {
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        }
    );
}
