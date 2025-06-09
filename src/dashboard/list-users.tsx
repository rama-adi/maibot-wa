import { renderToReadableStream } from "react-dom/server"
import DashboardShell from "./shell"
import DashboardError from "./error"
import renderLoginPage from "./login"
import { listAllUsers } from "@/database/queries/user-query";

export default async function renderUsersPage(req: Bun.BunRequest) {
    if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
        return await renderLoginPage();
    }

    try {
        const users = await listAllUsers();
        const currentTime = new Date().toISOString();

        return new Response(
            await renderToReadableStream(
                <DashboardShell>
                    <div className="min-h-screen bg-gray-50 p-6">
                        <div className="max-w-7xl mx-auto">
                            {/* Header */}
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">Users Management</h1>
                                <p className="text-gray-600">Overview of all registered users - Last updated: {currentTime}</p>
                                <div className="mt-4">
                                    <a 
                                        href="/dashboard" 
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        ← Back to Dashboard
                                    </a>
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Users</h3>
                                    <p className="text-3xl font-bold text-blue-600">{users.length}</p>
                                    <p className="text-sm text-gray-500">Registered users</p>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Users</h3>
                                    <p className="text-3xl font-bold text-green-600">{users.filter(user => !user.isBanned).length}</p>
                                    <p className="text-sm text-gray-500">Not banned</p>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Banned Users</h3>
                                    <p className="text-3xl font-bold text-red-600">{users.filter(user => user.isBanned).length}</p>
                                    <p className="text-sm text-gray-500">Currently banned</p>
                                </div>
                            </div>

                            {/* Users Table */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">All Users</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    {users.length === 0 ? (
                                        <div className="p-6">
                                            <p className="text-gray-500 italic text-center">No users found</p>
                                        </div>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        ID
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Name
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Public ID
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Bio
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Phone Hash
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {users.map((user, index) => (
                                                    <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {user.id}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {user.name}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                            {user.publicId}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                user.isBanned 
                                                                    ? 'bg-red-100 text-red-800' 
                                                                    : 'bg-green-100 text-green-800'
                                                            }`}>
                                                                {user.isBanned ? 'Banned' : 'Active'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                                                            <div className="truncate" title={user.bio || 'No bio'}>
                                                                {user.bio || <span className="italic text-gray-400">No bio</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                            <div className="truncate max-w-xs" title={user.phoneNumberHash || 'No hash'}>
                                                                {user.phoneNumberHash ? `${user.phoneNumberHash.substring(0, 8)}...` : 'N/A'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DashboardShell>
            ),
            {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                },
            }
        );
    } catch (error) {
        console.error('Error rendering users page:', error);
        return await DashboardError("Failed to load users data");
    }
} 