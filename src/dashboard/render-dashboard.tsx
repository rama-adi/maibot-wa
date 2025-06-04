import { renderToReadableStream } from "react-dom/server"
import DashboardShell from "./shell"
import DashboardError from "./error"
import { ALLOWED_GROUPS, rateLimiter, commandRouter, whatsapp } from "@/initialize";

async function renderLoginPage() {
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


export default async function renderDashboard(req: Bun.BunRequest) {

    if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
        return await renderLoginPage();
    }

    // Gather data from services
    const rateLimiterStats = rateLimiter.getStats();
    const availableCommands = Array.from(commandRouter['commands'].values()).map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        enabled: cmd.enabled,
        commandAvailableOn: cmd.commandAvailableOn
    }));

    const currentTime = new Date().toISOString();
    const systemStats = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: Bun.version,
        platform: process.platform
    };

    return new Response(
        await renderToReadableStream(
            <DashboardShell>
                <div className="min-h-screen bg-gray-50 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp Bot Dashboard</h1>
                            <p className="text-gray-600">System overview and statistics - Last updated: {currentTime}</p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Rate Limits</h3>
                                <p className="text-3xl font-bold text-blue-600">{rateLimiterStats.length}</p>
                                <p className="text-sm text-gray-500">Recipients with usage</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Commands</h3>
                                <p className="text-3xl font-bold text-green-600">{availableCommands.filter(cmd => cmd.enabled).length}</p>
                                <p className="text-sm text-gray-500">Enabled commands</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Allowed Groups</h3>
                                <p className="text-3xl font-bold text-purple-600">{ALLOWED_GROUPS.length}</p>
                                <p className="text-sm text-gray-500">Configured groups</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">System Uptime</h3>
                                <p className="text-3xl font-bold text-orange-600">{Math.floor(systemStats.uptime / 3600)}h</p>
                                <p className="text-sm text-gray-500">{Math.floor((systemStats.uptime % 3600) / 60)}m running</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Rate Limiter Section */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">Rate Limiter Status</h2>
                                </div>
                                <div className="p-6">
                                    {rateLimiterStats.length === 0 ? (
                                        <p className="text-gray-500 italic">No active rate limits</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {rateLimiterStats.map((stat, index) => {
                                                const isGroup = stat.recipient.includes('@g.us');
                                                const limit = isGroup ? 1000 : 100;
                                                const percentage = (stat.count / limit) * 100;
                                                return (
                                                    <div key={index} className="border rounded-lg p-4">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-medium text-sm">
                                                                {isGroup ? '🏷️ Group' : '👤 User'}: {stat.recipient.slice(0, 15)}...
                                                            </span>
                                                            <span className="text-sm text-gray-500">
                                                                {stat.count}/{limit}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                                            <div
                                                                className={`h-2 rounded-full ${percentage > 80 ? 'bg-red-500' :
                                                                        percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                                    }`}
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-500">
                                                            <span>Remaining: {stat.remaining}</span>
                                                            <span>Resets: {stat.resetTime.toLocaleTimeString()}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Commands Section */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">Available Commands</h2>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3">
                                        {availableCommands.map((cmd, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{cmd.name}</span>
                                                        <span className={`px-2 py-1 text-xs rounded-full ${cmd.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {cmd.enabled ? 'Enabled' : 'Disabled'}
                                                        </span>
                                                        {cmd.commandAvailableOn && (
                                                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                                                {cmd.commandAvailableOn}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">{cmd.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                            {/* Allowed Groups Section */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">Allowed Groups</h2>
                                </div>
                                <div className="p-6">
                                    {ALLOWED_GROUPS.length === 0 ? (
                                        <p className="text-gray-500 italic">No groups configured</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {ALLOWED_GROUPS.map((group, index) => (
                                                <li key={index} className="flex items-center p-2 bg-gray-50 rounded">
                                                    <span className="text-green-500 mr-2">✅</span>
                                                    <span className="font-mono text-sm">{group}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* System Information */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">System Information</h2>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Platform:</span>
                                            <span className="font-medium">{systemStats.platform}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Node Version:</span>
                                            <span className="font-medium">{systemStats.version}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Memory Usage:</span>
                                            <span className="font-medium">{Math.round(systemStats.memoryUsage.rss / 1024 / 1024)} MB</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Heap Used:</span>
                                            <span className="font-medium">{Math.round(systemStats.memoryUsage.heapUsed / 1024 / 1024)} MB</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Uptime:</span>
                                            <span className="font-medium">
                                                {Math.floor(systemStats.uptime / 3600)}h {Math.floor((systemStats.uptime % 3600) / 60)}m
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">WhatsApp Service:</span>
                                            <span className="flex items-center">
                                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                                <span className="font-medium text-green-600">Connected</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Real-time Activity Log */}
                        <div className="mt-8">
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="text-xl font-semibold text-gray-900">Real-time Activity Log</h2>
                                    <div className="flex items-center gap-2">
                                        <span id="connection-status" className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                        <span id="connection-text" className="text-sm text-gray-500">Connecting...</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div id="log-container" className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                                        <div className="text-gray-500">Waiting for activity...</div>
                                    </div>
                                    <div className="mt-4 flex justify-between items-center">
                                        <button 
                                            id="clear-logs" 
                                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                        >
                                            Clear Logs
                                        </button>
                                        <span id="log-count" className="text-sm text-gray-500">0 messages</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 text-center text-gray-500 text-sm">
                            <p>WhatsApp Bot Dashboard - Powered by Bun and React</p>
                        </div>
                    </div>
                </div>

                {/* Client-side JavaScript for SSE */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                        let eventSource;
                        let logCount = 0;
                        const maxLogs = 100;

                        function connectSSE() {
                            eventSource = new EventSource('/dashboard/streams');
                            
                            eventSource.onopen = function() {
                                document.getElementById('connection-status').className = 'w-2 h-2 bg-green-500 rounded-full';
                                document.getElementById('connection-text').textContent = 'Connected';
                                console.log('SSE connection established');
                            };

                            eventSource.onmessage = function(event) {
                                const logContainer = document.getElementById('log-container');
                                const timestamp = new Date().toLocaleTimeString();
                                
                                // Remove "Waiting for activity..." message if it exists
                                if (logContainer.children.length === 1 && logContainer.children[0].textContent === 'Waiting for activity...') {
                                    logContainer.innerHTML = '';
                                }
                                
                                // Create new log entry
                                const logEntry = document.createElement('div');
                                logEntry.className = 'mb-1 border-l-2 border-green-500 pl-2';
                                logEntry.innerHTML = \`<span class="text-gray-400">[\${timestamp}]</span> \${event.data}\`;
                                
                                // Add to container
                                logContainer.appendChild(logEntry);
                                logCount++;
                                
                                // Limit the number of logs displayed
                                while (logContainer.children.length > maxLogs) {
                                    logContainer.removeChild(logContainer.firstChild);
                                }
                                
                                // Auto-scroll to bottom
                                logContainer.scrollTop = logContainer.scrollHeight;
                                
                                // Update log count
                                document.getElementById('log-count').textContent = \`\${logCount} messages\`;
                            };

                            eventSource.onerror = function(error) {
                                document.getElementById('connection-status').className = 'w-2 h-2 bg-red-500 rounded-full';
                                document.getElementById('connection-text').textContent = 'Disconnected';
                                console.error('SSE connection error:', error);
                                
                                // Attempt to reconnect after 5 seconds
                                setTimeout(() => {
                                    if (eventSource.readyState === EventSource.CLOSED) {
                                        connectSSE();
                                    }
                                }, 5000);
                            };
                        }

                        // Clear logs functionality
                        document.getElementById('clear-logs').addEventListener('click', function() {
                            document.getElementById('log-container').innerHTML = '<div class="text-gray-500">Logs cleared...</div>';
                            logCount = 0;
                            document.getElementById('log-count').textContent = '0 messages';
                        });

                        // Start SSE connection when page loads
                        connectSSE();

                        // Cleanup on page unload
                        window.addEventListener('beforeunload', function() {
                            if (eventSource) {
                                eventSource.close();
                            }
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
    )
}