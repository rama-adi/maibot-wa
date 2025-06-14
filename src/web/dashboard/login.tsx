import { renderToReadableStream } from "react-dom/server";
import DashboardShell from "./shell";

export default async function renderLoginPage() {
    return new Response(
        await renderToReadableStream(
            <DashboardShell>
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Dashboard Login</h2>
                            <p className="text-gray-600">Please enter your dashboard key to continue</p>
                        </div>
                        <form method="POST" className="space-y-6">
                            <div>
                                <label htmlFor="key" className="block text-sm font-medium text-gray-700">
                                    Dashboard Key
                                </label>
                                <input
                                    type="password"
                                    name="key"
                                    id="key"
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Sign in
                            </button>
                        </form>
                    </div>
                </div>
            </DashboardShell>
        ),
        {
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        }
    );
}
