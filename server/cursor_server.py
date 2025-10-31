import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime
from typing import Optional

import markdown
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cursor Agent Server", description="Dedicated server for Cursor Agent WebSocket connections")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection management
ws_connections: dict[str, WebSocket] = {}

# Track active cursor processes for cleanup on server shutdown
_active_processes: dict[int, asyncio.subprocess.Process] = {}


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up all active processes on server shutdown"""
    logger.info("Cursor Agent Server shutting down, cleaning up active processes...")
    if _active_processes:
        logger.info(f"Terminating {len(_active_processes)} active cursor processes...")
        for pid, process in list(_active_processes.items()):
            try:
                if process.returncode is None:  # Process is still running
                    logger.info(f"Terminating process {pid}...")
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        logger.warning(f"Process {pid} did not terminate gracefully, killing...")
                        process.kill()
                        await process.wait()
                    logger.info(f"Process {pid} terminated")
            except Exception as e:
                logger.error(f"Error terminating process {pid}: {e}")
        _active_processes.clear()
        logger.info("All processes cleaned up")


@app.post("/api/chat/create")
async def create_chat():
    """Create a new Cursor session"""
    logger.info("Creating new chat session")
    try:
        result = subprocess.run(
            ['cursor', 'agent', 'create-chat'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.error(f"Error creating chat: {result.stderr}")
            return {"error": "Failed to create chat"}
        
        chat_id = result.stdout.strip()
        logger.info(f"Created chat: {chat_id}")
        return {"chatId": chat_id}
    except Exception as error:
        logger.error(f"Error: {error}")
        return {"error": "Internal server error"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, chatId: Optional[str] = Query(None)):
    """WebSocket endpoint, handles message sending and streaming responses"""
    await websocket.accept()
    ws_id = f"{datetime.now().timestamp()}-{id(websocket)}"
    ws_connections[ws_id] = websocket
    
    logger.info(f"WebSocket connection opened: {ws_id}, chatId: {chatId}")
    
    # Send connection success message with chatId
    await websocket.send_json({"type": "connected", "wsId": ws_id, "chatId": chatId})
    
    try:
        logger.info(f"WebSocket entering receive loop for {ws_id}")
        while True:
            # Receive message
            try:
                message_str = await websocket.receive_text()
                logger.info(f"WebSocket received message from {ws_id}: {message_str[:200]}")
            except WebSocketDisconnect as disconnect:
                # Normal client disconnect (e.g., page reload, navigation)
                # WebSocketDisconnect is raised with code and reason: (code, reason)
                logger.info(f"WebSocket client disconnected: {ws_id} (code: {disconnect.code}, reason: {disconnect.reason})")
                raise  # Re-raise to be caught by outer WebSocketDisconnect handler
            except Exception as recv_error:
                # Other errors during receive
                logger.error(f"Error receiving message from {ws_id}: {recv_error}")
                logger.error(f"Error type: {type(recv_error)}")
                raise
            
            try:
                data = json.loads(message_str)
                logger.info(f"Parsed message type: {data.get('type')}")
                
                if data.get('type') == 'send' and data.get('chatId') and data.get('prompt'):
                    chat_id = data['chatId']
                    prompt = data['prompt']
                    
                    logger.info("Processing message:")
                    logger.info(f"  - ChatId: {chat_id}")
                    logger.info(f"  - Prompt length: {len(prompt)}")
                    logger.info(f"  - Prompt preview: {prompt[:100].replace(chr(10), '\\n').replace(chr(9), '\\t')}")
                    logger.info(f"  - Prompt has tabs: {'\\t' in prompt}")
                    logger.info(f"  - Prompt has newlines: {'\\n' in prompt}")
                    
                    # Execute cursor command in headless mode
                    # --print: Enable headless mode (print responses to console, no interactive UI)
                    # --output-format stream-json: Use JSON streaming output format (only works with --print)
                    # --force: Bypass sandbox restrictions, allowing file writes and other operations
                    # --approve-mcps: Automatically approve all MCP servers (only works with --print/headless mode)
                    cmd = ['cursor', 'agent', '--print', '--output-format', 'stream-json', '--force', '--approve-mcps', '--resume', chat_id, prompt]
                    
                    logger.info("Spawning cursor command:")
                    logger.info(f"  - Command: cursor")
                    logger.info(f"  - Args: {' '.join(cmd[1:-1])} [prompt...]")
                    logger.info(f"  - Mode: headless (--print)")
                    logger.info(f"  - Output format: stream-json")
                    logger.info(f"  - Using --force flag to bypass sandbox restrictions for file editing")
                    logger.info(f"  - Using --approve-mcps flag to automatically approve MCP servers")
                    logger.info(f"  - Full command: cursor {' '.join(cmd[1:-1])} \"{prompt.replace(chr(10), '\\n').replace(chr(9), '\\t')[:50]}...\"")
                    
                    await process_cursor_command(cmd, websocket, ws_id)
                else:
                    logger.info(f"Received message with type: {data.get('type')}, but not processing (missing chatId or prompt)")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing WebSocket message: {e}")
                logger.error(f"Raw message: {message_str[:500]}")
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                
    except WebSocketDisconnect as disconnect:
        logger.info(f"WebSocket connection closed: {ws_id} (code: {disconnect.code}, reason: {disconnect.reason})")
    except Exception as e:
        logger.error(f"WebSocket error for {ws_id}: {e}")
    finally:
        if ws_id in ws_connections:
            del ws_connections[ws_id]


def extract_tool_name(event: dict) -> Optional[str]:
    """Extract tool name from event, trying various possible fields"""
    # Try various possible fields where tool name might be stored
    possible_fields = [
        'tool',
        'tool_name',
        'toolName',
        'function',
        'function_name',
        'name',
        'toolCall',
        'tool_call',
    ]
    
    # Check top-level fields
    for field in possible_fields:
        if field in event and event[field]:
            value = event[field]
            if isinstance(value, str):
                return value
            elif isinstance(value, dict) and 'name' in value:
                return value['name']
    
    # Check in nested structures
    if 'data' in event and isinstance(event['data'], dict):
        for field in possible_fields:
            if field in event['data']:
                value = event['data'][field]
                if isinstance(value, str):
                    return value
                elif isinstance(value, dict) and 'name' in value:
                    return value['name']
    
    # Check in arguments or params
    if 'arguments' in event and isinstance(event['arguments'], dict):
        if 'tool' in event['arguments']:
            return event['arguments']['tool']
    
    if 'params' in event and isinstance(event['params'], dict):
        if 'tool' in event['params']:
            return event['params']['tool']
    
    return None


def extract_file_edit_info(event: dict) -> Optional[dict]:
    """Extract file editing information from event"""
    file_path = None
    lines_added = 0
    lines_deleted = 0
    lines_changed = 0
    
    # Try to extract file path from various possible fields
    path_fields = ['path', 'file', 'file_path', 'filePath', 'target_file', 'targetFile', 'filePath']
    for field in path_fields:
        if field in event:
            value = event[field]
            if isinstance(value, str):
                file_path = value
                break
            elif isinstance(value, dict) and 'path' in value:
                file_path = value['path']
                break
    
    # Check in nested structures
    if not file_path and 'data' in event and isinstance(event['data'], dict):
        for field in path_fields:
            if field in event['data']:
                value = event['data'][field]
                if isinstance(value, str):
                    file_path = value
                    break
    
    # Try to extract edit statistics
    stats_fields = [
        ('lines_added', 'added', 'additions', 'addedLines'),
        ('lines_deleted', 'deleted', 'deletions', 'removedLines', 'deletedLines'),
        ('lines_changed', 'changed', 'modifications', 'modifiedLines'),
    ]
    
    for stat_name, *possible_fields in stats_fields:
        for field in possible_fields:
            if field in event:
                value = event[field]
                if isinstance(value, (int, float)):
                    if stat_name == 'lines_added':
                        lines_added = int(value)
                    elif stat_name == 'lines_deleted':
                        lines_deleted = int(value)
                    elif stat_name == 'lines_changed':
                        lines_changed = int(value)
                    break
    
    # Check in nested structures
    if 'data' in event and isinstance(event['data'], dict):
        data = event['data']
        for stat_name, *possible_fields in stats_fields:
            for field in possible_fields:
                if field in data:
                    value = data[field]
                    if isinstance(value, (int, float)):
                        if stat_name == 'lines_added':
                            lines_added = int(value)
                        elif stat_name == 'lines_deleted':
                            lines_deleted = int(value)
                        elif stat_name == 'lines_changed':
                            lines_changed = int(value)
                        break
    
    # Try to extract from diff or content
    if 'diff' in event:
        diff = event['diff']
        if isinstance(diff, str):
            # Count lines in diff more accurately
            lines = diff.split('\n')
            added_count = sum(1 for line in lines if line.startswith('+') and not line.startswith('+++'))
            deleted_count = sum(1 for line in lines if line.startswith('-') and not line.startswith('---'))
            if added_count > 0 or deleted_count > 0:
                lines_added = max(lines_added, added_count)
                lines_deleted = max(lines_deleted, deleted_count)
    
    # Also check content field for diff-like content
    if 'content' in event and isinstance(event['content'], str):
        content = event['content']
        if '+++' in content or '---' in content or content.strip().startswith('+') or content.strip().startswith('-'):
            lines = content.split('\n')
            added_count = sum(1 for line in lines if line.startswith('+') and not line.startswith('+++'))
            deleted_count = sum(1 for line in lines if line.startswith('-') and not line.startswith('---'))
            if added_count > 0 or deleted_count > 0:
                lines_added = max(lines_added, added_count)
                lines_deleted = max(lines_deleted, deleted_count)
    
    if file_path or lines_added > 0 or lines_deleted > 0 or lines_changed > 0:
        return {
            'file_path': file_path,
            'lines_added': lines_added,
            'lines_deleted': lines_deleted,
            'lines_changed': lines_changed
        }
    
    return None


def create_bubble_message(event_type: str, event: dict) -> Optional[dict]:
    """Create a bubble message for file edits or tool calls"""
    if event_type == 'file_edit' or 'edit' in str(event.get('type', '')).lower() or 'file' in str(event.get('type', '')).lower():
        edit_info = extract_file_edit_info(event)
        if edit_info:
            file_path = edit_info['file_path'] or '????'
            lines_added = edit_info['lines_added']
            lines_deleted = edit_info['lines_deleted']
            lines_changed = edit_info['lines_changed']
            
            # Build message
            parts = [f"?? ????: {file_path}"]
            stats = []
            
            if lines_added > 0:
                stats.append(f"+{lines_added} ?")
            if lines_deleted > 0:
                stats.append(f"-{lines_deleted} ?")
            if lines_changed > 0 and lines_added == 0 and lines_deleted == 0:
                stats.append(f"?? {lines_changed} ?")
            
            if stats:
                parts.append(f"({', '.join(stats)})")
            
            return {
                "type": "bubble",
                "category": "file_edit",
                "message": " ".join(parts),
                "file_path": file_path,
                "lines_added": lines_added,
                "lines_deleted": lines_deleted,
                "lines_changed": lines_changed
            }
    
    elif event_type == 'tool_call' or 'tool' in str(event.get('type', '')).lower():
        tool_name = extract_tool_name(event)
        if tool_name:
            return {
                "type": "bubble",
                "category": "tool_call",
                "message": f"?? ????: {tool_name}",
                "tool_name": tool_name
            }
    
    return None


def convert_markdown_to_html(markdown_text: str) -> str:
    """Convert markdown text to HTML"""
    if not markdown_text:
        return ""
    
    try:
        # Use markdown library with extensions for better support
        md = markdown.Markdown(extensions=['fenced_code', 'tables', 'nl2br'])
        html = md.convert(markdown_text)
        return html
    except Exception as e:
        logger.error(f"Error converting markdown to HTML: {e}")
        # Return escaped HTML if conversion fails
        return markdown_text.replace('<', '&lt;').replace('>', '&gt;')


def process_markdown_event(event: dict) -> dict:
    """Process markdown event and add HTML conversion"""
    # Check if this is a markdown event or final message
    event_type = event.get('type', '')
    subtype = event.get('subtype', '')
    
    # Debug: log all assistant events
    if event_type == 'assistant':
        logger.info(f"=== Processing assistant event ===")
        logger.info(f"Event type: {event_type}, subtype: {subtype}")
        logger.info(f"Event keys: {list(event.keys())}")
        logger.info(f"Event preview: {json.dumps(event, ensure_ascii=False)[:500]}")
    
    # Look for markdown content in various fields
    markdown_content = None
    
    # For assistant messages, check payload.message.content first
    # Always convert assistant message content to HTML (assistant messages usually contain markdown)
    if event_type == 'assistant':
        logger.info(f"Processing assistant message, event keys: {list(event.keys())}")
        
        # Check payload structure
        payload = event.get('payload')
        if payload and isinstance(payload, dict):
            logger.info(f"Assistant payload keys: {list(payload.keys())}")
            
            # Check payload.message.content (could be array or string)
            if 'message' in payload and isinstance(payload['message'], dict):
                logger.info(f"Found message in payload, message keys: {list(payload['message'].keys())}")
                msg_content = payload['message'].get('content')
                logger.info(f"Message content type: {type(msg_content)}, value preview: {str(msg_content)[:200] if msg_content else None}")
                
                if isinstance(msg_content, str) and msg_content.strip():
                    markdown_content = msg_content
                    logger.info(f"Found string content in payload.message.content (length: {len(markdown_content)})")
                elif isinstance(msg_content, list):
                    # Extract text from content array
                    text_parts = []
                    for item in msg_content:
                        if isinstance(item, dict) and item.get('type') == 'text' and 'text' in item:
                            text_parts.append(item['text'])
                    if text_parts:
                        markdown_content = '\n'.join(text_parts)
                        logger.info(f"Extracted text from content array (length: {len(markdown_content)})")
            
            # Also check payload.content and payload.text
            if not markdown_content:
                for field in ['content', 'text']:
                    if field in payload:
                        content = payload[field]
                        if isinstance(content, str) and content.strip():
                            markdown_content = content
                            logger.info(f"Found content in payload.{field} (length: {len(markdown_content)})")
                            break
        
        # Check top-level fields if not found in payload
        if not markdown_content:
            for field in ['content', 'text', 'message']:
                if field in event:
                    content = event[field]
                    if isinstance(content, str) and content.strip():
                        markdown_content = content
                        logger.info(f"Found content in top-level {field} (length: {len(markdown_content)})")
                        break
                    elif isinstance(content, dict) and 'content' in content:
                        # Nested message structure
                        nested_content = content.get('content')
                        if isinstance(nested_content, str) and nested_content.strip():
                            markdown_content = nested_content
                            logger.info(f"Found content in top-level {field}.content (length: {len(markdown_content)})")
                            break
                        elif isinstance(nested_content, list):
                            text_parts = []
                            for item in nested_content:
                                if isinstance(item, dict) and item.get('type') == 'text' and 'text' in item:
                                    text_parts.append(item['text'])
                            if text_parts:
                                markdown_content = '\n'.join(text_parts)
                                logger.info(f"Extracted text from top-level {field}.content array (length: {len(markdown_content)})")
                                break
        
        # If we found content for assistant message, skip further markdown detection
        # (assistant messages should always be converted to HTML)
        if markdown_content:
            # Convert to HTML immediately
            html_content = convert_markdown_to_html(markdown_content)
            event['html'] = html_content
            event['markdown'] = markdown_content  # Keep original markdown too
            logger.info(f"Converted assistant message to HTML (markdown length: {len(markdown_content)}, HTML length: {len(html_content)})")
            logger.info(f"HTML preview: {html_content[:200]}")
            return event
        else:
            logger.warning(f"No content found in assistant message, event structure: {json.dumps(event, indent=2)[:500]}")
    
    # Check top-level fields if not found in payload
    if not markdown_content:
        content_fields = ['content', 'text', 'message', 'body', 'markdown', 'md']
        for field in content_fields:
            if field in event:
                content = event[field]
                if isinstance(content, str) and content.strip():
                    # More aggressive detection: check if it looks like markdown
                    # Check for common markdown patterns
                    has_markdown_syntax = any(
                        md_syntax in content for md_syntax in [
                            '# ', '##', '###',  # headers
                            '```',  # code blocks
                            '* ', '- ',  # lists
                            '`',  # inline code
                            '[', '](',  # links
                            '**', '__',  # bold/italic
                            '> ',  # quotes
                        ]
                    )
                    
                    # If it's a message type or has markdown syntax, treat it as markdown
                    # Be more aggressive: if it's a message type or assistant type, always try to convert
                    is_markdown = (
                        event_type == 'message' or
                        event_type == 'assistant' or
                        'markdown' in event_type.lower() or
                        'markdown' in subtype.lower() or
                        subtype == 'markdown' or
                        has_markdown_syntax or
                        ((event_type == 'message' or event_type == 'assistant') and len(content) > 50)  # Long message likely markdown
                    )
                    
                    if is_markdown:
                        markdown_content = content
                        logger.info(f"Detected markdown in field '{field}', event type: {event_type}, subtype: {subtype}, length: {len(content)}")
                        break
    
    # If we found markdown content, convert it to HTML
    if markdown_content:
        html_content = convert_markdown_to_html(markdown_content)
        # Add HTML to event
        event['html'] = html_content
        event['markdown'] = markdown_content  # Keep original markdown too
        logger.info(f"Converted markdown to HTML (length: {len(markdown_content)} -> {len(html_content)})")
    
    return event


async def process_cursor_command(cmd: list[str], websocket: WebSocket, ws_id: str):
    """Process cursor command execution and stream output"""
    process = None
    try:
        # Send reset event at the start of a new command to reset UI state
        # Clear completed and tool_call states
        await websocket.send_json({
            "type": "reset",
            "message": "Starting new command",
            "clear_completed": True,
            "clear_tool_call": True
        })
        
        # Create subprocess using asyncio
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Track the process for cleanup on disconnect
        if process.pid:
            _active_processes[process.pid] = process
        
        logger.info(f"Process spawned, PID: {process.pid}")
        
        stdout_buffer = ''
        stderr_buffer = ''
        line_count = 0
        tools_called_count = 0  # Track total tools called
        
        # Create tasks to handle stdout and stderr
        async def handle_stdout():
            nonlocal stdout_buffer, line_count, tools_called_count
            while True:
                data = await process.stdout.readline()
                if not data:
                    break
                
                stdout_buffer += data.decode('utf-8', errors='replace')
                lines = stdout_buffer.split('\n')
                stdout_buffer = lines.pop() or ''
                
                for line in lines:
                    if line.strip():
                        line_count += 1
                        try:
                            event = json.loads(line)
                            event_type = event.get('type', '')
                            subtype = event.get('subtype', '')
                            
                            # Process tool-related events - check for tool indicators in various places
                            is_tool_event = (
                                'tool' in event_type.lower() or
                                subtype in ['tool', 'tool_call', 'calling_tool', 'tool-call'] or
                                'toolCall' in str(event) or
                                'tool_call' in str(event).lower() or
                                extract_tool_name(event) is not None
                            )
                            
                            if is_tool_event:
                                tool_name = extract_tool_name(event)
                                if tool_name:
                                    # Increment tools called count
                                    tools_called_count += 1
                                    
                                    # Add or update tool_name in the event for proper display
                                    event['tool_name'] = tool_name
                                    event['tools_called'] = tools_called_count
                                    logger.info(f"Extracted tool name: {tool_name}, total tools called: {tools_called_count}")
                                    
                                    # Send tools called count update (instead of remaining)
                                    await websocket.send_json({
                                        "type": "tools_status",
                                        "tools_called": tools_called_count,
                                        "message": f"{tools_called_count} tools called"
                                    })
                                    
                                    # Create and send bubble message for tool call
                                    bubble = create_bubble_message('tool_call', event)
                                    if bubble:
                                        await websocket.send_json(bubble)
                                        logger.info(f"Sent tool call bubble: {bubble['message']}")
                                else:
                                    # Skip unknown tool events (without tool names)
                                    logger.info(f"Skipping unknown tool event (line {line_count}): {event_type} {subtype}")
                                    continue
                            
                            # Check for file edit events
                            is_file_edit_event = (
                                'edit' in event_type.lower() or
                                'file' in event_type.lower() or
                                'write' in event_type.lower() or
                                'modify' in event_type.lower() or
                                subtype in ['edit', 'file_edit', 'write_file', 'edit_file'] or
                                extract_file_edit_info(event) is not None
                            )
                            
                            if is_file_edit_event:
                                # Create and send bubble message for file edit
                                bubble = create_bubble_message('file_edit', event)
                                if bubble:
                                    await websocket.send_json(bubble)
                                    logger.info(f"Sent file edit bubble: {bubble['message']}")
                            
                            # Check for completed/success events and clear tool_call
                            is_completed = (
                                event_type == 'result' or
                                subtype == 'success' or
                                subtype == 'completed' or
                                'completed' in event_type.lower() or
                                'success' in event_type.lower()
                            )
                            
                            if is_completed:
                                # Clear tool_call when completed
                                await websocket.send_json({
                                    "type": "clear_tool_call"
                                })
                                logger.info("Sent clear_tool_call event on completion")
                            
                            # Process markdown events and convert to HTML
                            event = process_markdown_event(event)
                            
                            logger.info(f"Sending event to client (line {line_count}): {event_type} {subtype}")
                            await websocket.send_json(event)
                        except json.JSONDecodeError:
                            logger.info(f"Failed to parse line {line_count}, sending as raw: {line[:100]}")
                            await websocket.send_json({
                                "type": "raw",
                                "data": line
                            })
        
        async def handle_stderr():
            nonlocal stderr_buffer
            while True:
                data = await process.stderr.readline()
                if not data:
                    break
                
                error_text = data.decode('utf-8', errors='replace')
                stderr_buffer += error_text
                logger.error(f"Process stderr: {error_text[:200]}")
                await websocket.send_json({
                    "type": "error",
                    "message": error_text
                })
        
        # Concurrently process stdout and stderr
        stdout_task = asyncio.create_task(handle_stdout())
        stderr_task = asyncio.create_task(handle_stderr())
        
        # Wait for process to complete
        return_code = await process.wait()
        signal = None  # asyncio subprocess doesn't provide signal information
        
        # Wait for output processing to complete
        await stdout_task
        await stderr_task
        
        logger.info("Process closed:")
        logger.info(f"  - Exit code: {return_code}")
        logger.info(f"  - Signal: {signal}")
        logger.info(f"  - Total lines processed: {line_count}")
        if stdout_buffer:
            logger.info(f"  - Remaining buffer: {stdout_buffer[:100]}")
        if stderr_buffer:
            logger.info(f"  - Total stderr: {stderr_buffer[:200]}")
        
        await websocket.send_json({
            "type": "result",
            "subtype": "success" if return_code == 0 else "error",
            "exitCode": return_code
        })
        
        # Clean up process reference after completion
        if process and process.pid and process.pid in _active_processes:
            del _active_processes[process.pid]
        
    except WebSocketDisconnect:
        # Client disconnected while process is running
        # Kill the process to prevent orphaned processes
        if process and process.pid:
            logger.warning(f"Client disconnected while process {process.pid} is running. Terminating process...")
            try:
                process.terminate()
                # Wait a bit for graceful termination
                await asyncio.wait_for(process.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                # Force kill if it doesn't terminate gracefully
                logger.warning(f"Process {process.pid} did not terminate gracefully, killing...")
                process.kill()
                await process.wait()
            finally:
                if process.pid and process.pid in _active_processes:
                    del _active_processes[process.pid]
            logger.info(f"Process {process.pid} terminated due to client disconnect")
        raise  # Re-raise to be handled by outer handler
        
    except Exception as error:
        logger.error(f"Process error: {error}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(error)
            })
        except:
            pass  # WebSocket might be closed
        # Clean up process reference
        if process and process.pid and process.pid in _active_processes:
            del _active_processes[process.pid]


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "Cursor Agent Server"}


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 3002))
    logger.info(f"Starting Cursor Agent Server on port {port} (NO RELOAD - processes persist)")
    uvicorn.run(app, host="0.0.0.0", port=port)

