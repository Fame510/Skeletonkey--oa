"use server"

import { generateText } from "ai"

export async function generateCodeFromDescription(description: string) {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Generate complete, production-ready code based on this description:
      
      ${description}
      
      Requirements:
      - Use modern React/Next.js patterns
      - Include proper TypeScript types
      - Add error handling
      - Follow best practices
      - Include comments explaining key parts
      - Make it fully functional and ready to inject
      
      Return only the code, no explanations.`,
    })

    return { success: true, code: text }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function optimizeCode(code: string) {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Optimize this code for better performance, readability, and maintainability:
      
      ${code}
      
      Focus on:
      - Performance improvements
      - Code organization
      - Type safety
      - Error handling
      - Best practices
      - Security considerations
      
      Return the optimized code with comments explaining the improvements.`,
    })

    return { success: true, code: text }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function explainCode(code: string) {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Provide a detailed explanation of this code:
      
      ${code}
      
      Explain:
      - What the code does
      - How it works
      - Key concepts used
      - Dependencies and their purposes
      - Potential use cases
      - Any notable patterns or techniques
      
      Make it educational and comprehensive.`,
    })

    return { success: true, explanation: text }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
