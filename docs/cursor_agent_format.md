# Cursor Agent Output Format

This document describes the output format of Cursor Agent when using the `--output-format stream-json` option.

## Overview

Cursor Agent outputs events in JSON format, with each event on a single line. The output stream can be parsed line-by-line, where each line is a complete JSON object.

## Command Usage

To generate JSON stream output, use the following command format:

```bash
cursor agent --print --output-format stream-json --force --approve-mcps --resume <chat_id> <prompt>
```

### Command Flags

- `--print`: Enable headless mode (print responses to console, no interactive UI)
- `--output-format stream-json`: Use JSON streaming output format (only works with `--print`)
- `--force`: Bypass sandbox restrictions, allowing file writes and other operations
- `--approve-mcps`: Automatically approve all MCP servers (only works with `--print`/headless mode)
- `--resume <chat_id>`: Resume an existing chat session

## Event Types

### 1. System Events

System initialization and configuration events.

#### `system.init`

```json
{
  "type": "system",
  "subtype": "init",
  "payload": {
    // System initialization data
  }
}
```

### 2. User Events

Events representing user input (typically sent from client, not received from agent).

```json
{
  "type": "user",
  "payload": {
    "prompt": "Write a simple Hello World program in Python"
  }
}
```

### 3. Thinking Events

Events indicating the agent is processing or thinking.

#### `thinking`

```json
{
  "type": "thinking",
  "subtype": "delta",
  "payload": {
    "content": "Processing the request..."
  }
}
```

Note: `thinking.delta` events are typically filtered out in the UI as they are frequent updates.

### 4. Assistant Events

Events containing the assistant's response messages.

```json
{
  "type": "assistant",
  "payload": {
    "message": {
      "content": [
        {
          "type": "text",
          "text": "I'll create a simple Hello World program in Python for you."
        }
      ]
    }
  }
}
```

The `content` field can be:
- A string: Direct text content
- An array: Array of content blocks, where each block has:
  - `type`: Type of content (e.g., "text")
  - `text`: The actual text content

### 5. Tool Call Events

Events representing tool invocations (e.g., file operations, shell commands).

#### `tool_call.started`

```json
{
  "type": "tool_call",
  "subtype": "started",
  "payload": {
    "toolCall": {
      "id": "tool-123",
      "shellToolCall": {
        "name": "shell",
        "args": {
          "command": "python hello_world.py"
        }
      }
    }
  }
}
```

#### `tool_call.completed`

```json
{
  "type": "tool_call",
  "subtype": "completed",
  "payload": {
    "toolCall": {
      "id": "tool-123",
      "result": {
        "exitCode": 0,
        "stdout": "Hello, World!\n",
        "stderr": ""
      }
    }
  }
}
```

Tool call structure:
- `toolCall.id`: Unique identifier for the tool call
- `toolCall.shellToolCall`: Shell command tool call details
  - `name`: Tool name (e.g., "shell")
  - `args.command`: The command being executed
- `toolCall.result`: Result of the tool execution (for completed events)
  - `exitCode`: Exit code (0 for success)
  - `stdout`: Standard output
  - `stderr`: Standard error output

### 6. Result Events

Events indicating the final result of the agent's task execution.

#### `result.success`

```json
{
  "type": "result",
  "subtype": "success",
  "exitCode": 0,
  "payload": {
    "exitCode": 0,
    "is_error": false
  }
}
```

#### `result.error`

```json
{
  "type": "result",
  "subtype": "error",
  "exitCode": 1,
  "payload": {
    "exitCode": 1,
    "is_error": true
  }
}
```

### 7. Error Events

Events representing errors that occurred during processing.

```json
{
  "type": "error",
  "message": "An error occurred while processing the request"
}
```

## Event Processing

### Parsing Events

Events are streamed line-by-line. Each line should be parsed as a complete JSON object:

```python
import json

for line in process.stdout:
    if line.strip():
        try:
            event = json.loads(line)
            event_type = event.get('type')
            subtype = event.get('subtype')
            # Process event...
        except json.JSONDecodeError:
            # Handle invalid JSON
            pass
```

### Event Flow Example

A typical flow for a simple task (e.g., "Write Hello World"):

1. **System initialization**: `system.init`
2. **User input**: `user` (sent from client)
3. **Thinking**: `thinking` events (may be multiple)
4. **Assistant response**: `assistant` (explaining what will be done)
5. **Tool calls**: 
   - `tool_call.started` (for file creation)
   - `tool_call.completed` (with file creation result)
   - `tool_call.started` (for running the program)
   - `tool_call.completed` (with execution result)
6. **Final result**: `result.success` or `result.error`

## Example: Hello World Program Generation

### Input

```bash
cursor agent --print --output-format stream-json --force --approve-mcps --resume <chat_id> "Write a simple Hello World program in Python"
```

### Expected Output Stream

```json
{"type": "system", "subtype": "init", "payload": {}}
{"type": "thinking", "payload": {"content": "I'll create a Hello World program..."}}
{"type": "assistant", "payload": {"message": {"content": [{"type": "text", "text": "I'll create a simple Hello World program in Python for you."}]}}}
{"type": "tool_call", "subtype": "started", "payload": {"toolCall": {"id": "write-file-1", "writeFileToolCall": {"path": "hello_world.py", "contents": "print('Hello, World!')"}}}}
{"type": "tool_call", "subtype": "completed", "payload": {"toolCall": {"id": "write-file-1", "result": {"success": true}}}}
{"type": "tool_call", "subtype": "started", "payload": {"toolCall": {"id": "shell-1", "shellToolCall": {"name": "shell", "args": {"command": "python hello_world.py"}}}}
{"type": "tool_call", "subtype": "completed", "payload": {"toolCall": {"id": "shell-1", "result": {"exitCode": 0, "stdout": "Hello, World!\n", "stderr": ""}}}}
{"type": "assistant", "payload": {"message": {"content": [{"type": "text", "text": "I've created a Hello World program and executed it. The output is 'Hello, World!'"}]}}}
{"type": "result", "subtype": "success", "exitCode": 0, "payload": {"exitCode": 0, "is_error": false}}
```

## Implementation Notes

### Client-Side Processing

In the client application:

1. **Event Filtering**: Some events may be filtered out for display:
   - `thinking.delta`: Frequent update events (typically hidden)
   - `system.init`: Initialization events (typically hidden)
   - Empty or duplicate events

2. **Event Aggregation**: 
   - Tool calls are tracked and aggregated (started/completed pairs)
   - Only the latest `result` event is typically displayed
   - `thinking` events are shown transiently (only when they're the most recent event)

3. **Event Storage**: Events are stored with metadata:
   ```typescript
   {
     id: string;
     chatId: string;
     timestamp: number;
     type: string;
     subtype?: string;
     payload: any;
     raw: string; // Original JSON string
   }
   ```

### Server-Side Processing

In the server (Python/FastAPI):

1. **WebSocket Streaming**: Events are forwarded to WebSocket clients as they arrive
2. **Error Handling**: Invalid JSON lines are wrapped in `raw` events or `error` events
3. **Process Management**: The cursor agent process is managed asynchronously, with stdout and stderr handled separately

## Error Handling

### Invalid JSON Lines

If a line cannot be parsed as JSON, it should be wrapped:

```json
{
  "type": "raw",
  "data": "<unparsed line content>"
}
```

### Process Errors

Process-level errors are reported as:

```json
{
  "type": "error",
  "message": "Error description"
}
```

## Best Practices

1. **Line-by-Line Parsing**: Always parse events line-by-line, as they arrive
2. **Error Tolerance**: Handle JSON parse errors gracefully
3. **Event Filtering**: Filter out noisy events (e.g., `thinking.delta`) for better UX
4. **State Management**: Track tool call states (started/completed) for progress indication
5. **Streaming**: Process events as they arrive rather than waiting for completion

## References

- Cursor Agent CLI documentation
- This implementation: `/server/main.py` (WebSocket handler)
- Client implementation: `/client/src/App.tsx` (Event processing)

