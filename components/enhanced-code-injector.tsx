"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Code,
  FileText,
  Package,
  Key,
  Upload,
  CheckCircle,
  Zap,
  Server,
  Globe,
  Layers,
  AlertTriangle,
  Mic,
  MicOff,
  Cloud,
  Database,
} from "lucide-react"

interface ModuleAnalysis {
  type: "frontend" | "backend" | "fullstack" | "other"
  routes: string[]
  secrets: string[]
  imports: string[]
  exports: string[]
  functions: string[]
  components: string[]
  dependencies: string[]
  fileStructure: { [key: string]: string }
  availableSecrets: string[]
  aiInsights?: string
  errors: string[]
  parsingStrategy: string
  manifest: {
    id: string
    name: string
    type: string
    format: string
    secrets: string[]
    routes: string[]
    dependencies: string[]
    entry: string
    code: string
    createdAt: string
  }
}

interface InjectionResponse {
  success: boolean
  moduleId?: string
  environment?: string
  storage?: string
  analysis?: ModuleAnalysis
  error?: string
  errors?: string[]
  troubleshooting?: {
    fileSystem: string
    parsing: string
    execution: string
  }
}

export default function EnhancedCodeInjector() {
  const [code, setCode] = useState("")
  const [analysis, setAnalysis] = useState<ModuleAnalysis | null>(null)
  const [format, setFormat] = useState<"js" | "ts" | "jsx" | "tsx">("js")
  const [enableAI, setEnableAI] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [modules, setModules] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [environment, setEnvironment] = useState<string>("unknown")

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()

      recognitionInstance.continuous = true
      recognitionInstance.interimResults = true
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          setCode((prev) => prev + finalTranscript)
        }
      }

      recognitionInstance.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        setIsListening(false)
      }

      recognitionInstance.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognitionInstance)
    }

    // Load existing modules
    loadModules()
  }, [])

  const loadModules = async () => {
    try {
      const response = await fetch("/api/inject")
      const data = await response.json()
      setModules(data.modules || [])
      setEnvironment(data.environment || "unknown")
    } catch (error) {
      console.error("Failed to load modules:", error)
    }
  }

  const toggleVoiceInput = () => {
    if (!recognition) {
      setErrors((prev) => [...prev, "Speech recognition not supported in this browser"])
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
    }
  }

  const handleSubmit = async () => {
    if (!code.trim()) return

    setIsAnalyzing(true)
    setErrors([])
    setAnalysis(null)

    try {
      const response = await fetch("/api/inject", {
        method: "POST",
        body: JSON.stringify({ code, format, enableAI }),
        headers: { "Content-Type": "application/json" },
      })

      const result: InjectionResponse = await response.json()

      if (result.success) {
        setAnalysis(result.analysis!)
        setEnvironment(result.environment || "unknown")
        loadModules() // Refresh modules list

        // Show warnings for parsing errors
        if (result.analysis?.errors?.length) {
          setErrors(result.analysis.errors)
        }
      } else {
        setErrors(result.errors || [result.error || "Unknown error"])
      }
    } catch (error) {
      console.error("Failed to inject code:", error)
      setErrors([`Network error: ${error}`])
    }

    setIsAnalyzing(false)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "frontend":
        return <Globe className="h-4 w-4" />
      case "backend":
        return <Server className="h-4 w-4" />
      case "fullstack":
        return <Layers className="h-4 w-4" />
      default:
        return <Code className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "frontend":
        return "bg-blue-500"
      case "backend":
        return "bg-green-500"
      case "fullstack":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStrategyBadgeColor = (strategy: string) => {
    if (strategy.includes("fallback")) return "destructive"
    if (strategy.includes("minimal")) return "secondary"
    return "default"
  }

  const getEnvironmentIcon = () => {
    switch (environment) {
      case "serverless":
        return <Cloud className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">ModularCore - Serverless Code Injector</h1>
        <p className="text-muted-foreground">
          Trust-based code injection system optimized for serverless environments - with AI analysis and in-memory
          execution
        </p>
        <div className="flex items-center gap-2 mt-2">
          {getEnvironmentIcon()}
          <Badge variant="outline">Environment: {environment}</Badge>
          <Badge variant="secondary">Storage: In-Memory</Badge>
          <Badge variant="outline">Platform: v0.dev/Vercel</Badge>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <strong>Issues Detected:</strong>
              {errors.map((error, index) => (
                <div key={index} className="text-sm">
                  • {error}
                </div>
              ))}
              <div className="text-xs mt-2 opacity-75">
                💡 Tip: Serverless environments use in-memory storage. Modules reset on function restart.
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Code Input */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Serverless Code Injection Terminal
              </CardTitle>
              <CardDescription>
                Drop any code here - optimized for serverless execution with in-memory storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-center">
                <Select value={format} onValueChange={(value: any) => setFormat(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="js">JavaScript</SelectItem>
                    <SelectItem value="ts">TypeScript</SelectItem>
                    <SelectItem value="jsx">JSX</SelectItem>
                    <SelectItem value="tsx">TSX</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Switch id="ai-mode" checked={enableAI} onCheckedChange={setEnableAI} />
                  <label htmlFor="ai-mode" className="text-sm">
                    AI Analysis
                  </label>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleVoiceInput}
                  className={isListening ? "bg-red-100" : ""}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isListening ? "Stop" : "Voice"}
                </Button>
              </div>

              <Textarea
                placeholder={`// Drop your ${format.toUpperCase()} code here...
// Example: Serverless API with environment variables
export async function GET(request) {
  const apiKey = process.env.WEATHER_API_KEY;
  const city = request.nextUrl.searchParams.get('city') || 'London';
  
  const response = await fetch(
    \`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}\`
  );
  
  const data = await response.json();
  return Response.json(data);
}

// Or Express-style backend
import express from 'express';
const app = express();

app.get('/hello', (req, res) => {
  const name = process.env.USER_NAME || 'World';
  res.json({ message: \`Hello, \${name}!\` });
});

export default app;`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />

              <Button
                onClick={handleSubmit}
                disabled={isAnalyzing || !code.trim()}
                className="w-full flex items-center gap-2"
                size="lg"
              >
                <Upload className="h-4 w-4" />
                {isAnalyzing ? "Injecting & Analyzing..." : "Inject Code (Serverless)"}
              </Button>

              {isListening && (
                <Alert>
                  <Mic className="h-4 w-4" />
                  <AlertDescription>🎤 Listening for voice input... Speak your code naturally.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              In-Memory Modules
            </CardTitle>
            <CardDescription>Currently loaded in serverless memory</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {modules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div>No modules in memory</div>
                  <div className="text-xs mt-1">Modules reset on function restart</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {modules.map((module) => (
                    <div key={module.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(module.type)}
                        <span className="font-semibold text-sm">{module.name}</span>
                        <div className={`w-2 h-2 rounded-full ${getTypeColor(module.type)}`} />
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Type: {module.type}</div>
                        <div>Format: {module.format}</div>
                        <div>Created: {new Date(module.createdAt).toLocaleTimeString()}</div>
                        {module.routes?.length > 0 && <div>Routes: {module.routes.join(", ")}</div>}
                        {module.secrets?.length > 0 && <div>Secrets: {module.secrets.length}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Serverless Module Analysis
                  <Badge variant={getStrategyBadgeColor(analysis.parsingStrategy)}>{analysis.parsingStrategy}</Badge>
                  <Badge variant="outline">
                    <Cloud className="h-3 w-3 mr-1" />
                    In-Memory
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Analysis results for serverless execution using {analysis.parsingStrategy} parsing strategy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="structure">Structure</TabsTrigger>
                    <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                    <TabsTrigger value="secrets">Secrets</TabsTrigger>
                    <TabsTrigger value="routes">Routes</TabsTrigger>
                    <TabsTrigger value="ai">AI Insights</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold flex items-center justify-center gap-2">
                          {getTypeIcon(analysis.type)}
                          {analysis.type}
                        </div>
                        <div className="text-sm text-muted-foreground">Module Type</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.components.length}</div>
                        <div className="text-sm text-muted-foreground">Components</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.functions.length}</div>
                        <div className="text-sm text-muted-foreground">Functions</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.routes.length}</div>
                        <div className="text-sm text-muted-foreground">Routes</div>
                      </div>
                    </div>

                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        ✅ Module successfully injected with ID: <code>{analysis.manifest.id}</code>
                        <br />
                        🏗️ Parsed using: <strong>{analysis.parsingStrategy}</strong> strategy
                        <br />
                        ☁️ Stored in: <strong>Serverless in-memory registry</strong>
                        <br />⏰ Created: <strong>{new Date(analysis.manifest.createdAt).toLocaleString()}</strong>
                        {analysis.errors.length > 0 && (
                          <>
                            <br />
                            ⚠️ {analysis.errors.length} parsing warning(s) - module still functional
                          </>
                        )}
                      </AlertDescription>
                    </Alert>

                    <Alert variant="secondary">
                      <Cloud className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Serverless Environment Notes:</strong>
                        <br />• Modules are stored in memory and will reset on function restart
                        <br />• No persistent file system - all storage is temporary
                        <br />• Optimized for v0.dev/Vercel serverless execution
                        <br />• Environment variables are securely injected per module
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="structure" className="space-y-4">
                    <div className="mb-4">
                      <Badge variant="outline" className="mb-2">
                        Virtual File Structure (In-Memory)
                      </Badge>
                    </div>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {Object.entries(analysis.fileStructure).map(([filePath, content]) => (
                          <div key={filePath} className="border rounded p-3">
                            <div className="font-mono text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                              <Database className="h-3 w-3" />
                              {filePath}
                            </div>
                            <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                              {typeof content === "string" && content.length > 200
                                ? `${content.substring(0, 200)}...`
                                : content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="dependencies" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Dependencies ({analysis.dependencies.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.dependencies.map((dep, i) => (
                          <Badge key={i} variant="secondary">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                      {analysis.dependencies.length === 0 && (
                        <p className="text-muted-foreground">No external dependencies detected</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Imports</h4>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {analysis.imports.map((imp, i) => (
                            <div key={i} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {imp}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="secrets" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Environment Variables
                      </h4>
                      {analysis.secrets.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.secrets.map((secret, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                              <Badge variant="secondary">{secret}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {analysis.availableSecrets.includes(secret) ? "✅ Available" : "❌ Missing"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No environment variables detected</p>
                      )}
                    </div>

                    <Alert variant="secondary">
                      <Key className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Serverless Security:</strong> Environment variables are securely injected per module
                        execution context. Only requested secrets are accessible to each module.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="routes" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        API Routes ({analysis.routes.length})
                      </h4>
                      {analysis.routes.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.routes.map((route, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                              <Badge variant="outline">{route}</Badge>
                              <span className="text-sm text-muted-foreground">
                                → Virtual route in serverless context
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No API routes detected</p>
                      )}
                    </div>

                    <Alert variant="secondary">
                      <Cloud className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Serverless Routing:</strong> Routes are executed in isolated serverless functions with
                        controlled access to environment variables and resources.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        AI-Powered Serverless Analysis
                      </h4>
                      {analysis.aiInsights ? (
                        <ScrollArea className="h-96">
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                              {analysis.aiInsights}
                            </pre>
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          {enableAI
                            ? "AI analysis not available (check GROQ_API_KEY)"
                            : "Enable AI analysis to get serverless-specific insights"}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
