import { type NextRequest, NextResponse } from "next/server"
import { getModule, getAvailableSecrets } from "@/lib/code-analyzer"

// This route handler will dynamically execute injected backend modules
export async function GET(request: NextRequest, { params }: { params: { moduleId: string } }) {
  return handleDynamicModuleRequest(request, params.moduleId, "GET")
}

export async function POST(request: NextRequest, { params }: { params: { moduleId: string } }) {
  return handleDynamicModuleRequest(request, params.moduleId, "POST")
}

export async function PUT(request: NextRequest, { params }: { params: { moduleId: string } }) {
  return handleDynamicModuleRequest(request, params.moduleId, "PUT")
}

export async function DELETE(request: NextRequest, { params }: { params: { moduleId: string } }) {
  return handleDynamicModuleRequest(request, params.moduleId, "DELETE")
}

// Generic handler to fetch and execute the module
async function handleDynamicModuleRequest(request: NextRequest, moduleId: string, method: string) {
  try {
    const moduleManifest = await getModule(moduleId)

    if (!moduleManifest) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    if (moduleManifest.type === "frontend") {
      return NextResponse.json({ error: "Frontend modules cannot be executed via API" }, { status: 400 })
    }

    // Prepare a safe execution context for the module
    const availableSecrets = getAvailableSecrets()
    const moduleEnv = Object.fromEntries(
      moduleManifest.secrets.filter((s) => availableSecrets.includes(s)).map((s) => [s, process.env[s]]),
    )

    const moduleContext = {
      require: (id: string) => {
        // Basic mock for common modules, or throw for unsupported ones
        if (id === "express") {
          // Mock a simple express app for compatibility
          return {
            Router: () => ({
              get: (path: string, handler: Function) => console.log(`Mock Express GET ${path}`),
              post: (path: string, handler: Function) => console.log(`Mock Express POST ${path}`),
              put: (path: string, handler: Function) => console.log(`Mock Express PUT ${path}`),
              delete: (path: string, handler: Function) => console.log(`Mock Express DELETE ${path}`),
              patch: (path: string, handler: Function) => console.log(`Mock Express PATCH ${path}`),
              use: (handler: Function) => console.log(`Mock Express USE`),
            }),
            json: () => {}, // Mock express.json()
          }
        }
        // For other modules, try to import them if they are node built-ins or installed
        try {
          return require(id)
        } catch (e) {
          console.warn(`Module '${id}' not found in dynamic context.`, e.message)
          throw new Error(
            `Cannot dynamically require '${id}'. Only built-in Node.js modules or pre-installed packages are supported.`,
          )
        }
      },
      module: { exports: {} as any },
      exports: {} as any,
      console: console,
      process: { env: moduleEnv },
      __dirname: "/tmp/modules/" + moduleId, // Mock a temporary directory
      __filename: "/tmp/modules/" + moduleId + "/index.js",
      // Mock Next.js specific objects for API routes
      NextRequest: request,
      NextResponse: NextResponse,
      Response: Response, // Global Response object
    }

    // Wrap the module code in an IIFE to control scope and capture exports
    const wrappedCode = `
      (function(require, module, exports, console, process, __dirname, __filename, NextRequest, NextResponse, Response) {
        ${moduleManifest.code}
        return module.exports.default || module.exports; // Capture default export or entire exports object
      })
    `

    let moduleHandler: any
    try {
      const moduleFunction = eval(wrappedCode)
      moduleHandler = moduleFunction(
        moduleContext.require,
        moduleContext.module,
        moduleContext.exports,
        moduleContext.console,
        moduleContext.process,
        moduleContext.__dirname,
        moduleContext.__filename,
        moduleContext.NextRequest,
        moduleContext.NextResponse,
        moduleContext.Response,
      )
    } catch (evalError) {
      console.error(`Error evaluating module ${moduleId}:`, evalError)
      return NextResponse.json({ error: `Error evaluating module: ${evalError.message}` }, { status: 500 })
    }

    // Handle different types of module exports
    if (typeof moduleHandler === "function") {
      // If the module exports a function (e.g., a Next.js API route function)
      // Pass the request and response objects (or mock them for Express-style)
      if (moduleManifest.routes.some((r) => r.startsWith(method))) {
        // Check if the method is defined in manifest
        // For Next.js API routes (GET, POST, etc. functions)
        return await moduleHandler(request, NextResponse)
      } else {
        // For generic functions, or if it's an Express-style app
        // We need to mock req/res for Express-style handlers
        const mockReq = {
          ...request,
          method,
          url: request.nextUrl.pathname,
          query: Object.fromEntries(request.nextUrl.searchParams),
          body: await request.json().catch(() => ({})),
        }
        let mockResData: any = {}
        const mockRes = {
          json: (data: any) => {
            mockResData = data
            return mockRes
          },
          status: (s: number) => {
            mockResData.status = s
            return mockRes
          },
          send: (data: any) => {
            mockResData = data
            return mockRes
          },
          end: () => {},
        }
        await moduleHandler(mockReq, mockRes)
        return NextResponse.json(mockResData, { status: mockResData.status || 200 })
      }
    } else if (typeof moduleHandler === "object" && moduleHandler !== null) {
      // If the module exports an object (e.g., an Express app instance)
      // This is more complex in serverless. We'd need to simulate Express routing.
      // For now, we'll assume direct function exports for simplicity in serverless.
      // If the user's code is an Express app, it won't run as a full server.
      // We'll try to find a method matching the request method.
      const handlerMethod = moduleHandler[method.toLowerCase()]
      if (typeof handlerMethod === "function") {
        return await handlerMethod(request, NextResponse)
      } else {
        // If it's an Express app, it needs to be handled differently.
        // For now, we'll return a generic response.
        return NextResponse.json(
          {
            message: `Module ${moduleId} loaded, but no direct handler for ${method} found.`,
            moduleType: moduleManifest.type,
            handlerType: typeof moduleHandler,
          },
          { status: 200 },
        )
      }
    } else {
      return NextResponse.json(
        { error: `Module ${moduleId} did not export a runnable function or object.` },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error(`Error executing module ${moduleId}:`, error)
    return NextResponse.json({ error: `Failed to execute module: ${error.message}` }, { status: 500 })
  }
}
