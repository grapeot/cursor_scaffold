import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime
from typing import Optional

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


async def process_cursor_command(cmd: list[str], websocket: WebSocket, ws_id: str):
    """Process cursor command execution and stream output"""
    process = None
    try:
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
        
        # Create tasks to handle stdout and stderr
        async def handle_stdout():
            nonlocal stdout_buffer, line_count
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
                            logger.info(f"Sending event to client (line {line_count}): {event.get('type')} {event.get('subtype', '')}")
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

