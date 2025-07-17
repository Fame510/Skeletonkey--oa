import { parse } from "@babel/parser"
import path from "path"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { modules } from "../drizzle/schema" // Adjust path if your schema file is elsewhere
import { eq } from "drizzle-orm" // Add this import for eq

export interface CodeAnalysis {
  type: "frontend" | "backend" | "fullstack" | "other"
  routes: string[]
  secrets: string[]
  imports: string[]
  exports: string[]
  functions: string[]
  components: string[]
  dependencies: string[]
  fileStructure: { [key: string]: string }
  manifest: ModuleManifest
  errors: string[]
  parsingStrategy: string
}

export interface ModuleManifest {
  id: string
  name: string
  type: "frontend" | "backend" | "fullstack"
  format: "js" | "ts" | "jsx" | "tsx"
  secrets: string[]
  routes: string[]
  dependencies: string[]
  entry: string
  code: string
  createdAt: string
}

// Initialize Drizzle client (ensure DATABASE_URL is set in environment)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

// Get the appropriate storage directory for the environment
function getStorageDir(): string {
  // For serverless environments (Vercel, AWS Lambda, etc.)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
    return "/tmp/modules"
  }
  // For local development
  return path.join(process.cwd(), "modules")
}

export async function analyzeCode(code: string, format: "js" | "ts" | "jsx" | "tsx" = "js"): Promise<CodeAnalysis> {
  const errors: string[] = []
  let ast: any
  let parsingStrategy = "unknown"

  // Strategy 1: Modern configuration with proper decorator handling
  try {
    parsingStrategy = "modern-decorators"
    ast = parse(code, {
      sourceType: "module",
      plugins: [
        format.includes("jsx") || format.includes("tsx") ? "jsx" : null,
        format.includes("ts") ? "typescript" : null,
        ["decorators", { decoratorsBeforeExport: true }],
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "dynamicImport",
        "importAttributes",
        "topLevelAwait",
        "asyncGenerators",
        "functionBind",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "bigInt",
        "importMeta",
      ].filter(Boolean),
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      strictMode: false,
      errorRecovery: true,
    })
  } catch (modernError) {
    errors.push(`Modern parsing failed: ${modernError.message}`)

    // Strategy 2: Legacy decorators
    try {
      parsingStrategy = "legacy-decorators"
      ast = parse(code, {
        sourceType: "module",
        plugins: [
          format.includes("jsx") || format.includes("tsx") ? "jsx" : null,
          format.includes("ts") ? "typescript" : null,
          "decorators-legacy",
          "classProperties",
          "optionalChaining",
          "nullishCoalescingOperator",
          "dynamicImport",
          "topLevelAwait",
          "asyncGenerators",
          "functionBind",
          "exportDefaultFrom",
          "exportNamespaceFrom",
        ].filter(Boolean),
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        strictMode: false,
        errorRecovery: true,
      })
    } catch (legacyError) {
      errors.push(`Legacy parsing failed: ${legacyError.message}`)

      // Strategy 3: Fallback to regex analysis
      console.warn("All AST parsing strategies failed, using regex fallback")
      return createFallbackAnalysis(code, format, errors, "regex-fallback")
    }
  }

  console.log(`✅ Code parsed successfully using strategy: ${parsingStrategy}`)

  const secrets: string[] = []
  const routes: string[] = []
  const imports: string[] = []
  const exports: string[] = []
  const functions: string[] = []
  const components: string[] = []
  let type: "frontend" | "backend" | "fullstack" | "other" = "other"

  // Enhanced AST traversal
  function traverse(node: any, depth = 0) {
    if (!node || typeof node !== "object" || depth > 100) return

    try {
      // Extract environment variables
      if (
        node.type === "MemberExpression" &&
        node.object?.object?.name === "process" &&
        node.object?.property?.name === "env" &&
        node.property?.name
      ) {
        secrets.push(node.property.name)
      }

      // Extract Express routes
      if (
        node.type === "ExpressionStatement" &&
        node.expression?.callee?.object?.name === "app" &&
        node.expression?.callee?.property?.name &&
        ["get", "post", "put", "delete", "patch", "use"].includes(node.expression.callee.property.name)
      ) {
        type = type === "frontend" ? "fullstack" : "backend"
        if (node.expression.arguments?.[0]?.value) {
          routes.push(`${node.expression.callee.property.name.toUpperCase()} ${node.expression.arguments[0].value}`)
        }
      }

      // Extract Next.js API routes
      if (
        node.type === "ExportNamedDeclaration" &&
        node.declaration?.type === "FunctionDeclaration" &&
        ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(node.declaration.id?.name)
      ) {
        type = type === "frontend" ? "fullstack" : "backend"
        routes.push(`${node.declaration.id.name} /api/...`)
      }

      // Extract imports
      if (node.type === "ImportDeclaration" && node.source?.value) {
        imports.push(node.source.value)
      }

      // Extract exports
      if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
        if (node.declaration?.id?.name) {
          exports.push(node.declaration.id.name)
        }
        if (node.declaration?.declarations) {
          node.declaration.declarations.forEach((decl: any) => {
            if (decl.id?.name) exports.push(decl.id.name)
          })
        }

        // Check for React components
        if (hasJSXContent(node.declaration)) {
          type = type === "backend" ? "fullstack" : "frontend"
          if (node.declaration?.id?.name) {
            components.push(node.declaration.id.name)
          }
        }
      }

      // Extract function declarations
      if (node.type === "FunctionDeclaration" && node.id?.name) {
        functions.push(node.id.name)
        if (/^[A-Z]/.test(node.id.name) && hasJSXContent(node)) {
          components.push(node.id.name)
          type = type === "backend" ? "fullstack" : "frontend"
        }
      }

      // Extract variable declarations
      if (node.type === "VariableDeclaration") {
        node.declarations?.forEach((decl: any) => {
          if (
            decl.id?.name &&
            (decl.init?.type === "ArrowFunctionExpression" || decl.init?.type === "FunctionExpression")
          ) {
            functions.push(decl.id.name)
            if (/^[A-Z]/.test(decl.id.name) && hasJSXContent(decl.init)) {
              components.push(decl.id.name)
              type = type === "backend" ? "fullstack" : "frontend"
            }
          }
        })
      }

      // Recursively traverse child nodes
      for (const key in node) {
        if (node.hasOwnProperty(key) && node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            node[key].forEach((child: any) => traverse(child, depth + 1))
          } else {
            traverse(node[key], depth + 1)
          }
        }
      }
    } catch (traverseError) {
      console.warn(`Traversal error at depth ${depth}:`, traverseError.message)
    }
  }

  // Helper function to detect JSX content
  function hasJSXContent(node: any): boolean {
    if (!node) return false
    if (node.type === "JSXElement" || node.type === "JSXFragment") return true
    if (node.body?.body) {
      return node.body.body.some((child: any) => hasJSXContent(child))
    }
    if (node.body) return hasJSXContent(node.body)
    if (node.consequent) return hasJSXContent(node.consequent)
    if (node.alternate) return hasJSXContent(node.alternate)
    return false
  }

  // Start traversal
  if (ast?.program?.body) {
    ast.program.body.forEach((node: any) => traverse(node))
  }

  // Filter available secrets from environment
  const envVars = Object.keys(process.env)
  const availableSecrets = [...new Set(secrets)].filter((secret) => envVars.includes(secret))

  // Extract dependencies from imports
  const dependencies = [...new Set(imports.filter((imp) => !imp.startsWith(".") && !imp.startsWith("/")))]

  // Generate file structure
  const fileStructure = generateFileStructure(code, type, components, functions, format)

  // Create manifest
  const manifest: ModuleManifest = {
    id: `module_${Date.now()}`,
    name: `Generated Module`,
    type,
    format,
    secrets: availableSecrets,
    routes: [...new Set(routes)],
    dependencies,
    entry: `index.${format}`,
    code,
    createdAt: new Date().toISOString(),
  }

  return {
    type,
    routes: [...new Set(routes)],
    secrets: availableSecrets,
    imports: [...new Set(imports)],
    exports: [...new Set(exports)],
    functions: [...new Set(functions)],
    components: [...new Set(components)],
    dependencies,
    fileStructure,
    manifest,
    errors,
    parsingStrategy,
  }
}

function createFallbackAnalysis(code: string, format: string, errors: string[], strategy: string): CodeAnalysis {
  console.warn("Using enhanced regex-based analysis")

  try {
    // Enhanced regex patterns
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g
    const exportRegex = /export\s+(?:default\s+)?(?:function\s+|const\s+|let\s+|var\s+|class\s+)?(\w+)/g
    const envRegex = /process\.env\.(\w+)/g
    const functionRegex =
      /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)|let\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)|var\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function))/g
    const routeRegex = /app\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/g
    const nextApiRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g

    const imports: string[] = []
    const exports: string[] = []
    const envVars: string[] = []
    const functions: string[] = []
    const routes: string[] = []

    let match

    // Extract all patterns
    while ((match = importRegex.exec(code)) !== null) imports.push(match[1])
    while ((match = exportRegex.exec(code)) !== null) exports.push(match[1])
    while ((match = envRegex.exec(code)) !== null) envVars.push(match[1])
    while ((match = functionRegex.exec(code)) !== null) {
      const funcName = match[1] || match[2] || match[3] || match[4]
      if (funcName) functions.push(funcName)
    }
    while ((match = routeRegex.exec(code)) !== null) routes.push(`${match[1].toUpperCase()} ${match[2]}`)
    while ((match = nextApiRegex.exec(code)) !== null) routes.push(`${match[1]} /api/...`)

    const components = functions.filter((fn) => /^[A-Z]/.test(fn))
    const dependencies = [...new Set(imports.filter((imp) => !imp.startsWith(".") && !imp.startsWith("/")))]
    const availableSecrets = [...new Set(envVars)].filter((secret) => Object.keys(process.env).includes(secret))

    // Determine type
    let type: "frontend" | "backend" | "fullstack" | "other" = "other"
    const hasReact = code.includes("React") || code.includes("jsx") || code.includes("JSX") || components.length > 0
    const hasBackend = routes.length > 0 || code.includes("express") || code.includes("req,") || code.includes("res,")

    if (hasReact && hasBackend) {
      type = "fullstack"
    } else if (hasReact) {
      type = "frontend"
    } else if (hasBackend) {
      type = "backend"
    }

    const fileStructure = generateFileStructure(code, type, components, functions, format)

    const manifest: ModuleManifest = {
      id: `module_${Date.now()}`,
      name: `Generated Module (${strategy})`,
      type,
      format,
      secrets: availableSecrets,
      routes: [...new Set(routes)],
      dependencies,
      entry: `index.${format}`,
      code,
      createdAt: new Date().toISOString(),
    }

    return {
      type,
      routes: [...new Set(routes)],
      secrets: availableSecrets,
      imports: [...new Set(imports)],
      exports: [...new Set(exports)],
      functions: [...new Set(functions)],
      components: [...new Set(components)],
      dependencies,
      fileStructure,
      manifest,
      errors,
      parsingStrategy: strategy,
    }
  } catch (regexError) {
    console.error("Even regex fallback failed:", regexError)
    errors.push(`Regex fallback failed: ${regexError.message}`)

    // Return minimal analysis
    const manifest: ModuleManifest = {
      id: `module_${Date.now()}`,
      name: `Basic Module`,
      type: "other",
      format,
      secrets: [],
      routes: [],
      dependencies: [],
      entry: `index.${format}`,
      code,
      createdAt: new Date().toISOString(),
    }

    return {
      type: "other",
      routes: [],
      secrets: [],
      imports: [],
      exports: [],
      functions: [],
      components: [],
      dependencies: [],
      fileStructure: { [`index.${format}`]: code },
      manifest,
      errors,
      parsingStrategy: "minimal-fallback",
    }
  }
}

function generateFileStructure(
  code: string,
  type: string,
  components: string[],
  functions: string[],
  format: string,
): { [key: string]: string } {
  const structure: { [key: string]: string } = {}

  // Main entry file
  structure[`index.${format}`] = code

  // Package.json for dependencies
  structure["package.json"] = JSON.stringify(
    {
      name: "injected-module",
      version: "1.0.0",
      type: "module",
      main: `index.${format}`,
    },
    null,
    2,
  )

  // Component files for frontend
  if ((type === "frontend" || type === "fullstack") && components.length > 0) {
    components.forEach((comp) => {
      structure[`components/${comp}.${format}`] =
        `// ${comp} component\nexport default function ${comp}() {\n  return <div>${comp}</div>;\n}`
    })
  }

  // API routes for backend
  if (type === "backend" || type === "fullstack") {
    structure["routes/api.js"] =
      '// API routes\nexport default function handler(req, res) {\n  res.json({ message: "API endpoint" });\n}'
  }

  // Utility functions
  if (functions.length > 0) {
    structure[`utils/index.${format}`] =
      `// Utility functions\n${functions.map((fn) => `export function ${fn}() {\n  // ${fn} implementation\n}`).join("\n\n")}`
  }

  return structure
}

export async function injectModule(manifest: ModuleManifest): Promise<void> {
  try {
    await db.insert(modules).values({
      id: manifest.id,
      code: manifest.code,
      format: manifest.format,
      manifest: manifest as any, // Drizzle jsonb type casting
      createdAt: new Date(),
    })
    console.log(`✅ Module ${manifest.id} saved to database successfully`)
  } catch (error) {
    console.error(`❌ Failed to save module ${manifest.id} to database:`, error)
    throw error
  }
}

export function getAvailableSecrets(): string[] {
  return Object.keys(process.env).filter(
    (key) => key.includes("API_KEY") || key.includes("SECRET") || key.includes("TOKEN") || key.includes("PASSWORD"),
  )
}

export async function getModule(moduleId: string): Promise<ModuleManifest | undefined> {
  const result = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1)
  return result[0] ? (result[0].manifest as ModuleManifest) : undefined
}

export async function getAllModules(): Promise<ModuleManifest[]> {
  const results = await db.select().from(modules)
  return results.map((row) => row.manifest as ModuleManifest)
}
