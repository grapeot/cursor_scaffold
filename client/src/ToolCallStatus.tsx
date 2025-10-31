import { useState } from 'react';
import type { ChatEvent } from './types';

interface ToolInfo {
  id: string;
  started?: ChatEvent;
  completed?: ChatEvent;
}

interface ToolCallStatusProps {
  total: number;
  completed: number;
  tools: ToolInfo[];
}

/**
 * Extract tool information from tool call events according to Cursor Agent format.
 * Supports multiple tool types: shellToolCall, writeFileToolCall, etc.
 * Format reference: docs/cursor_agent_format.md
 */
function ToolCallStatus({ total: _total, completed, tools }: ToolCallStatusProps) {
  const [expanded, setExpanded] = useState(false);

  // Extract tool information from event according to documented format
  const getToolInfo = (tool: ToolInfo) => {
    const started = tool.started;
    if (!started) {
      return {
        toolName: 'Unknown Tool',
        command: 'Unknown',
        id: tool.id,
        description: '',
      };
    }

    const payload = started.payload || {};
    const toolCall = payload.toolCall || {};
    
    let toolName = 'Tool';
    let command = '';
    let description = '';
    
    // Extract based on tool type according to cursor_agent_format.md
    if (toolCall.shellToolCall) {
      // Shell command tool
      const shellCall = toolCall.shellToolCall;
      toolName = shellCall.name || 'Shell';
      command = shellCall.args?.command || '';
      description = `Execute: ${command}`;
    } else if (toolCall.writeFileToolCall) {
      // File write tool
      const writeCall = toolCall.writeFileToolCall;
      toolName = 'Write File';
      command = writeCall.path || '';
      const contentPreview = writeCall.contents 
        ? (writeCall.contents.length > 50 
          ? writeCall.contents.substring(0, 50) + '...' 
          : writeCall.contents)
        : '';
      description = `Write to ${command}${contentPreview ? ` (${contentPreview})` : ''}`;
    } else if (toolCall.readFileToolCall) {
      // File read tool
      const readCall = toolCall.readFileToolCall;
      toolName = 'Read File';
      command = readCall.path || '';
      description = `Read from ${command}`;
    } else if (toolCall.name) {
      // Generic tool with name
      toolName = toolCall.name;
      command = toolCall.args ? JSON.stringify(toolCall.args) : '';
      description = `${toolName}${command ? `: ${command}` : ''}`;
    } else {
      // Fallback: try to extract from payload directly
      toolName = payload.name || toolCall.name || 'Tool';
      command = toolCall.command || payload.command || '';
      description = command || 'Unknown operation';
    }
    
    return {
      toolName,
      command: typeof command === 'string' ? command : JSON.stringify(command),
      description,
      id: tool.id,
    };
  };

  return (
    <div className="mr-auto max-w-[90%] bg-yellow-50 border border-yellow-200 rounded-lg">
      <div 
        className="flex items-center justify-between gap-2 text-xs text-gray-700 p-2.5 cursor-pointer hover:bg-yellow-100 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {completed > 0 && (
            <>
              <span className="text-blue-600 font-semibold text-base">{completed}</span>
              <span>{completed === 1 ? 'tool called' : 'tools called'}</span>
            </>
          )}
        </div>
        <span className="text-gray-500 text-xs">
          {expanded ? '▼' : '▶'}
        </span>
      </div>
      
      {expanded && tools.length > 0 && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {tools.map((tool) => {
            const toolInfo = getToolInfo(tool);
            const isCompleted = !!tool.completed;
            
            return (
              <div
                key={tool.id}
                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                    isCompleted ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800 mb-1">
                      {toolInfo.toolName}
                    </div>
                    {toolInfo.description && (
                      <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded border border-gray-200 break-all">
                        {toolInfo.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ToolCallStatus;
