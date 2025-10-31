import { useState } from 'react';

interface ToolInfo {
  id: string;
  started?: any;
  completed?: any;
}

interface ToolCallStatusProps {
  total: number;
  completed: number;
  tools: ToolInfo[];
}

function ToolCallStatus({ total, completed, tools }: ToolCallStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const pending = total - completed;
  const allCompleted = completed === total && total > 0;

  // Extract tool information
  const getToolInfo = (tool: ToolInfo) => {
    const started = tool.started;
    const payload = started?.payload || {};
    const toolCall = payload?.toolCall || {};
    
    // Try to get command from shellToolCall
    const command = toolCall?.shellToolCall?.args?.command || 
                   toolCall?.command || 
                   payload?.command ||
                   'Unknown tool';
    
    // Try to get tool name
    const toolName = toolCall?.shellToolCall?.name ||
                    toolCall?.name ||
                    payload?.name ||
                    'Tool';
    
    return {
      toolName,
      command: typeof command === 'string' ? command : JSON.stringify(command),
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
          {allCompleted ? (
            <>
              <span className="text-green-600 font-semibold text-base">✓</span>
              <span>Tools completed</span>
            </>
          ) : (
            <>
              <div className="relative">
                <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                {pending > 1 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                    {pending}
                  </span>
                )}
              </div>
              <span>Calling tools{pending > 1 ? ` (${pending} remaining)` : ''}</span>
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
                    <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded border border-gray-200 break-all">
                      {toolInfo.command}
                    </div>
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
