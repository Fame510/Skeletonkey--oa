"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wand2, Copy, CheckCircle } from "lucide-react"
import { generateCodeFromDescription } from "@/lib/ai-actions"

interface AICodeGeneratorProps {
  onCodeGenerated: (code: string) => void
}

export function AICodeGenerator({ onCodeGenerated }: AICodeGeneratorProps) {
  const [description, setDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState("")
  const [error, setError] = useState("")

  const handleGenerate = async () => {
    if (!description.trim()) return

    setIsGenerating(true)
    setError("")

    const result = await generateCodeFromDescription(description)

    if (result.success) {
      setGeneratedCode(result.code)
    } else {
      setError(result.error || "Failed to generate code")
    }

    setIsGenerating(false)
  }

  const handleInjectCode = () => {
    if (generatedCode) {
      onCodeGenerated(generatedCode)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          AI Code Generator
        </CardTitle>
        <CardDescription>Describe what you want to build and AI will generate the code for you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Describe the code you want to generate...
Example: Create a React component for a todo list with add, delete, and mark complete functionality using TypeScript and Tailwind CSS"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[100px]"
        />

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="flex items-center gap-2"
        >
          <Wand2 className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate Code"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {generatedCode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Generated Code:</h4>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleInjectCode}>
                  <CheckCircle className="h-4 w-4" />
                  Inject
                </Button>
              </div>
            </div>
            <Textarea value={generatedCode} readOnly className="min-h-[200px] font-mono text-sm" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
