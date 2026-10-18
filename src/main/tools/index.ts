import type { ToolDef, ToolSchema } from './types'
import { readTool } from './read'
import { writeTool } from './write'
import { editTool } from './edit'
import { globTool } from './glob'
import { grepTool } from './grep'
import { listTool } from './list'

export const TOOLS: ToolDef[] = [readTool, writeTool, editTool, globTool, grepTool, listTool]

export function toolSchemas(): ToolSchema[] {
  return TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))
}

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find((tool) => tool.name === name)
}

export type { ToolDef, ToolOutcome, ProposedChange, ToolContext, ToolSchema } from './types'
