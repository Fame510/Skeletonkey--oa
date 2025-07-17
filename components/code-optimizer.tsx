"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Zap, RefreshCw, BookOpen } from "lucide-react"
import { optimizeCode, explainCode } from "@/lib/ai-actions"

interface CodeOptimizerProps {
  code: string
  onCodeOptimized: (optimizedCode: string) => void
}

export function CodeOptimizer({ code, onCodeOptimized }: CodeOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")

  const handleOptimize = async () => {
    if (!code.trim()) return

    setIsOptimizing(true)
    const result = await optimizeCode(code)

    if (result.success) {
      onCodeOptimized(result.code)
    }

    setIsOptimizing(false)
  }

  const handleExplain = async () => {
    if (!code.trim()) return

    setIsExplaining(true)
    const result = await explainCode(code)

    if (result.success) {
      setExplanation(result.explanation)
    }

    setIsExplaining(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          AI Code Tools
        </CardTitle>
        <CardDescription>Optimize and understand your code with AI assistance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleOptimize} disabled={isOptimizing || !code.trim()} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {isOptimizing ? "Optimizing..." : "Optimize Code"}
          </Button>

          <Button
            onClick={handleExplain}
            disabled={isExplaining || !code.trim()}
            variant="outline"
            className="flex items-center gap-2 bg-transparent"
          >
            <BookOpen className="h-4 w-4" />
            {isExplaining ? "Explaining..." : "Explain Code"}
          </Button>
        </div>

        {explanation && (
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              <div className="mt-2 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm">{explanation}</pre>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
