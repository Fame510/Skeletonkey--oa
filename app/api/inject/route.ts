import { type NextRequest, NextResponse } from "next/server"
import { analyzeCode, injectModule, getAvailableSecrets, getAllModules } from "@/lib/code-analyzer"
import { generateText } from "ai"
import { minimax } from "vercel-minimax-ai-provider"

export async function POST(request: NextRequest) {
  try {
    const { code, format = "js", enableAI = false } = await request.json()

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 })
    }

    console.log(`🔍 Analyzing ${format} code (${code.length} characters) in serverless environment`)

    // Analyze the code with enhanced error handling
    const analysis = await analyzeCode(code, format)

    // Check for critical parsing errors
    if (analysis.errors.length > 0) {
      console.warn("⚠️ Parsing errors detected:", analysis.errors)

      // If we have a minimal fallback, continue with warnings
      if (analysis.parsingStrategy === "minimal-fallback") {
        return NextResponse.json(
          {
            success: false,
            error: "Code parsing failed completely",
            errors: analysis.errors,
            suggestion: "Please check your code syntax and try again",
          },
          { status: 400 },
        )
      }
    }

    console.log(`✅ Code analyzed successfully using ${analysis.parsingStrategy} strategy`)

    // Get available secrets
    const availableSecrets = getAvailableSecrets()

    // AI-enhanced analysis if requested
    let aiInsights = null
    if (enableAI && process.env.MINIMAX_API_KEY) {
      try {
        const { text } = await generateText({
          model: minimax("MiniMax-M2"),
          prompt: `Analyze this ${format} code for a serverless environment:

Code:
${code}

Analysis Results:
- Type: ${analysis.type}
- Components: ${analysis.components.join(", ")}
- Functions: ${analysis.functions.join(", ")}
- Dependencies: ${analysis.dependencies.join(", ")}
- Routes: ${analysis.routes.join(", ")}
- Parsing Strategy: ${analysis.parsingStrategy}
- Environment: Serverless (v0.dev/Vercel)

Provide:
1. Serverless compatibility assessment
2. Security recommendations for trust-based injection
3. Performance optimizations for serverless
4. Best practices for in-memory module execution
5. Potential issues with file system limitations

Be specific and actionable for serverless deployment.`,
        })
        aiInsights = text
      } catch (aiError) {
        console.error("AI analysis failed:", aiError)
      }
    }

    // Inject the module using in-memory storage (serverless-compatible)
    const moduleId = analysis.manifest.id

    try {
      await injectModule(analysis.manifest)
      console.log(`🚀 Module ${moduleId} saved to database successfully`)
    } catch (injectionError) {
      console.error("Module database save failed:", injectionError)
      return NextResponse.json(
        {
          success: false,
          error: `Module database save failed: ${injectionError}`,
          details: "Ensure DATABASE_URL is correctly configured and database is accessible.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      moduleId,
      environment: "serverless",
      storage: "database",
      analysis: {
        ...analysis,
        availableSecrets,
        aiInsights,
      },
    })
  } catch (error) {
    console.error("❌ Code injection failed:", error)

    // Enhanced error response for serverless debugging
    return NextResponse.json(
      {
        success: false,
        error: `Code injection failed: ${error}`,
        details: error instanceof Error ? error.message : String(error),
        environment: "serverless",
        suggestion: "Check serverless function logs for detailed error information",
        troubleshooting: {
          fileSystem: "Using in-memory storage (no file system writes)",
          parsing: "Multiple parsing strategies attempted",
          execution: "Safe execution context with controlled environment",
        },
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const modules = await getAllModules()

    return NextResponse.json({
      modules,
      count: modules.length,
      environment: "serverless",
      storage: "database",
      note: "Modules are persisted in PostgreSQL database.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to list modules from database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
