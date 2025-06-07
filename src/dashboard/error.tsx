import { renderToReadableStream } from "react-dom/server";
import DashboardShell from "./shell";

export default async function DashboardError(err: string) {
    return new Response(
        await renderToReadableStream(
            <DashboardShell>
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Occurred</h2>
                            <p className="text-gray-600">{err}</p>
                        </div>
                    </div>
                </div>
            </DashboardShell>
        )
    );
}