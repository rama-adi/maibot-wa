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
                <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Command Tester</h1>
                            <p className="text-gray-600 mt-2">Test and monitor your bot commands in real-time</p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Command Tester Section */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                                <div className="px-6 py-5 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                            <span className="text-white text-lg">⚡</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">Test Commands</h2>
                                            <p className="text-sm text-gray-600">Test bot commands directly without WhatsApp</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <form id="command-form" className="flex gap-2" autoComplete="off">
                                        <input 
                                            id="command-input" 
                                            type="text" 
                                            className="flex-1 border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200" 
                                            placeholder="Enter command (e.g., music help me erinn)" 
                                        />
                                        <button 
                                            type="submit" 
                                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                                        >
                                            Run
                                        </button>
                                    </form>
                                    
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-700">Response:</label>
                                        <pre id="command-output" className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[120px] max-h-[300px] overflow-y-auto shadow-inner">No command executed yet</pre>
                                    </div>
                                    
                                    <div className="text-xs text-gray-500">
                                        <p><strong>Examples:</strong></p>
                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                            <li><code>music help me erinn</code> - Test the problematic command</li>
                                            <li><code>help</code> - Show help menu</li>
                                            <li><code>music folern</code> - Search for a song</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Real-time Activity Log */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                                            <span className="text-white text-lg">📊</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">Real-time Activity Log</h2>
                                            <p className="text-sm text-gray-600">Monitor command execution in real-time</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span id="connection-status" className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                        <span id="connection-text" className="text-sm text-gray-500">Connecting...</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div id="log-container" className="bg-gray-900 text-green-400 p-5 rounded-lg font-mono text-sm h-80 overflow-y-auto shadow-inner border border-gray-700">
                                        <div className="text-gray-500">Waiting for activity...</div>
                                    </div>
                                    <div className="mt-4 flex justify-between items-center">
                                        <button 
                                            id="clear-logs" 
                                            className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 text-sm transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                                        >
                                            Clear Logs
                                        </button>
                                        <span id="log-count" className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">0 messages</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                        let eventSource;
                        let logCount = 0;
                        const maxLogs = 100;

                        function connectSSE() {
                            // Close existing connection if any
                            if (eventSource) {
                                eventSource.close();
                            }
                            
                            eventSource = new EventSource('/dashboard/streams');
                            
                            eventSource.onopen = function() {
                                document.getElementById('connection-status').className = 'w-2 h-2 bg-green-500 rounded-full';
                                document.getElementById('connection-text').textContent = 'Connected';
                                console.log('SSE connection established');
                            };

                            eventSource.onmessage = function(event) {
                                // Ignore heartbeat messages (they start with empty data or are comments)
                                if (!event.data || event.data.trim() === '' || event.data.startsWith('heartbeat')) {
                                    return;
                                }
                                
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
                                
                                // Close the connection to prevent further errors
                                if (eventSource) {
                                    eventSource.close();
                                }
                                
                                // Attempt to reconnect after 5 seconds
                                setTimeout(() => {
                                    connectSSE();
                                }, 5000);
                            };
                        }

                        // Command form functionality
                        document.getElementById('command-form').addEventListener('submit', async function(e) {
                            e.preventDefault();
                            const input = document.getElementById('command-input').value;
                            const outputElement = document.getElementById('command-output');
                            
                            // Show loading state
                            outputElement.textContent = 'Executing command...';
                            
                            const formData = new FormData();
                            formData.append('command', input);
                            
                            try {
                                const res = await fetch('/dashboard/command', { method: 'POST', body: formData });
                                const data = await res.json();
                                outputElement.textContent = data.result || 'No response';
                            } catch (error) {
                                outputElement.textContent = 'Error: ' + error.message;
                            }
                        });

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
    );
}
