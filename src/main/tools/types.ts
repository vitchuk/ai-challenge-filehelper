export interface ToolContext {
  root: string
}

export interface ProposedChange {
  path: string
  before: string | null
  after: string
  tool: 'write' | 'edit'
}

export interface ToolOutcome {
  output: string
  isError?: boolean
  change?: ProposedChange
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome>
}

export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
