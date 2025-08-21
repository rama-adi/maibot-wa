import { Fragment, useState } from "react"
import { Button } from "@/web/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/web/components/ui/card"
import { Input } from "@/web/components/ui/input"
import { Label } from "@/web/components/ui/label"
import { Checkbox } from "@/web/components/ui/checkbox"
import { Separator } from "@/web/components/ui/separator"
import { Badge } from "@/web/components/ui/badge"
import { trpc } from "@/web/trpc/client"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Play, MessageSquare, Users, AlertCircle, CheckCircle2 } from "lucide-react"
import Markdown from 'react-markdown';

export default function CommandTester() {
    const [message, setMessage] = useState("")
    const [isGroup, setIsGroup] = useState(false)
    const [lastResult, setLastResult] = useState<string[] | null>(null)

    const runCommandMutation = useMutation({
        ...trpc.dashboard.runCommand.mutationOptions({}),
        onSuccess: (data) => {
            setLastResult(data.replies)
        },
        onError: (error) => {
            console.error("Command execution failed:", error)
            setLastResult([`Error: ${error.message}`])
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return

        runCommandMutation.mutate({
            message: message.trim(),
            group: isGroup
        })
    }

    const isLoading = runCommandMutation.isPending

    return (
        <div className="container mx-auto max-w-4xl p-8 space-y-8">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <MessageSquare className="size-8 text-primary" />
                    <h1 className="text-3xl font-bold tracking-tight">Command Tester</h1>
                    <Badge variant="outline" className="text-xs">Dashboard Tool</Badge>
                </div>
                <p className="text-muted-foreground max-w-2xl">
                    Test bot commands directly from the dashboard. This simulates a WhatsApp message and shows how the bot would respond.
                </p>
            </header>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Command Input Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Play className="size-5" />
                            Test Command
                        </CardTitle>
                        <CardDescription>
                            Enter a message to test how the bot would respond. You can simulate both private and group chat contexts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Input
                                    id="message"
                                    placeholder="Type your command or message here..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    disabled={isLoading}
                                    className="min-h-[2.5rem]"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="group"
                                    checked={isGroup}
                                    onCheckedChange={(checked) => setIsGroup(checked === true)}
                                    disabled={isLoading}
                                />
                                <Label htmlFor="group" className="flex items-center gap-2">
                                    <Users className="size-4" />
                                    Simulate as group chat
                                </Label>
                            </div>

                            <Separator />

                            <div className="flex items-center gap-3">
                                <Button 
                                    type="submit" 
                                    disabled={!message.trim() || isLoading}
                                    className="flex-1"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Running Command...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="size-4" />
                                            Test Command
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>

                        {/* Quick Examples */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Quick Examples</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    "help",
                                    "music folern",
                                    "ping"
                                ].map((example) => (
                                    <Button
                                        key={example}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMessage(example)}
                                        disabled={isLoading}
                                        className="justify-start text-xs"
                                    >
                                        {example}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Display */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {lastResult === null ? (
                                <MessageSquare className="size-5 text-muted-foreground" />
                            ) : runCommandMutation.isError ? (
                                <AlertCircle className="size-5 text-destructive" />
                            ) : (
                                <CheckCircle2 className="size-5 text-green-600" />
                            )}
                            Bot Response
                        </CardTitle>
                        <CardDescription>
                            {lastResult === null 
                                ? "Command responses will appear here"
                                : runCommandMutation.isError
                                ? "An error occurred while executing the command"
                                : `${lastResult.length} response${lastResult.length !== 1 ? 's' : ''} received`
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {lastResult === null ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground">
                                <div className="text-center space-y-2">
                                    <MessageSquare className="size-8 mx-auto opacity-50" />
                                    <p className="text-sm">No commands tested yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {lastResult.length === 0 ? (
                                    <div className="flex items-center justify-center h-20 text-muted-foreground">
                                        <div className="text-center space-y-1">
                                            <p className="text-sm">No response from bot</p>
                                            <p className="text-xs opacity-70">The command may not have triggered any replies</p>
                                        </div>
                                    </div>
                                ) : (
                                    lastResult.map((reply, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    Reply {index + 1}
                                                </Badge>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary/20">
                                                <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-3 prose-headings:my-4">
                                                    <Markdown 
                                                        components={{
                                                            p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>
                                                        }}
                                                    >
                                                        {reply}
                                                    </Markdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Context Information */}
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-lg">Testing Context</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label className="text-sm font-medium">Simulated User</Label>
                        <p className="text-sm text-muted-foreground mt-1">Dashboard User (000000000000)</p>
                    </div>
                    <div>
                        <Label className="text-sm font-medium">Chat Type</Label>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            {isGroup ? (
                                <>
                                    <Users className="size-4" />
                                    Group Chat
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="size-4" />
                                    Private Chat
                                </>
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
