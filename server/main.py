import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket 连接管理
ws_connections: dict[str, WebSocket] = {}


@app.post("/api/chat/create")
async def create_chat():
    """创建新的 Cursor 会话"""
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
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 端点，处理消息发送和流式响应"""
    await websocket.accept()
    ws_id = f"{datetime.now().timestamp()}-{id(websocket)}"
    ws_connections[ws_id] = websocket
    
    logger.info(f"WebSocket connection opened: {ws_id}")
    
    # 发送连接成功消息
    await websocket.send_json({"type": "connected", "wsId": ws_id})
    
    try:
        while True:
            # 接收消息
            message_str = await websocket.receive_text()
            logger.info(f"WebSocket received message from {ws_id}: {message_str[:200]}")
            
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
                    
                    # 执行 cursor 命令
                    # 使用 --force 参数来绕过沙箱限制，允许文件写入等操作
                    cmd = ['cursor', 'agent', '--print', '--output-format', 'stream-json', '--force', '--resume', chat_id, prompt]
                    
                    logger.info("Spawning cursor command:")
                    logger.info(f"  - Command: cursor")
                    logger.info(f"  - Args: {' '.join(cmd[1:-1])} [prompt...]")
                    logger.info(f"  - Using --force flag to bypass sandbox restrictions for file editing")
                    logger.info(f"  - Full command: cursor {' '.join(cmd[1:-1])} \"{prompt.replace(chr(10), '\\n').replace(chr(9), '\\t')[:50]}...\"")
                    
                    await process_cursor_command(cmd, websocket, ws_id)
                else:
                    logger.info(f"Received message with type: {data.get('type')}, but not processing (missing chatId or prompt)")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing WebSocket message: {e}")
                logger.error(f"Raw message: {message_str[:500]}")
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket connection closed: {ws_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {ws_id}: {e}")
    finally:
        if ws_id in ws_connections:
            del ws_connections[ws_id]


async def process_cursor_command(cmd: list[str], websocket: WebSocket, ws_id: str):
    """处理 cursor 命令的执行和流式输出"""
    try:
        # 使用 asyncio 创建子进程
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        logger.info(f"Process spawned, PID: {process.pid}")
        
        stdout_buffer = ''
        stderr_buffer = ''
        line_count = 0
        
        # 创建任务来处理 stdout 和 stderr
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
        
        # 并发处理 stdout 和 stderr
        stdout_task = asyncio.create_task(handle_stdout())
        stderr_task = asyncio.create_task(handle_stderr())
        
        # 等待进程完成
        return_code = await process.wait()
        signal = None  # asyncio subprocess 不提供 signal 信息
        
        # 等待输出处理完成
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
        
    except Exception as error:
        logger.error(f"Process error: {error}")
        await websocket.send_json({
            "type": "error",
            "message": str(error)
        })


@app.get("/")
async def root():
    """健康检查端点"""
    return {"status": "ok", "service": "Cursor Client Backend"}


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=port)

