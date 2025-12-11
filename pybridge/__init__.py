"""
PyBridge - Bridge Python to TypeScript Frontends

A library for creating type-safe bridges between Python backends
and TypeScript frontends with automatic client generation.

Example usage:

    # main.py
    from pybridge import Bridge, command
    from pydantic import BaseModel
    
    class User(BaseModel):
        id: int
        name: str
    
    @command
    async def get_user(user_id: int) -> User:
        return User(id=user_id, name="Alice")
    
    app = Bridge(
        generate_ts="../frontend/src/api.ts",
        port=8000
    )
    
    if __name__ == "__main__":
        app.run(dev=True)

For streaming support:

    from pybridge import command, Channel
    
    @command
    async def stream_data(channel: Channel[dict]) -> None:
        for i in range(10):
            await channel.send({"value": i})
            await asyncio.sleep(0.1)
"""

__version__ = "0.1.0"
__author__ = "PyBridge Team"

# Core exports
from .registry import command, get_registry, CommandRegistry, CommandInfo
from .bridge import Bridge
from .channel import Channel, ChannelManager, channel_manager
from .runner import run
from .generator import generate_typescript
from .errors import (
    BridgeError,
    ValidationError,
    CommandNotFoundError,
    CommandExecutionError,
    ChannelError,
    InternalError,
)

__all__ = [
    # Version
    "__version__",
    
    # Core
    "Bridge",
    "command",
    "run",
    
    # Streaming
    "Channel",
    "ChannelManager",
    "channel_manager",
    
    # Registry
    "get_registry",
    "CommandRegistry",
    "CommandInfo",
    
    # TypeScript generation
    "generate_typescript",
    
    # Errors
    "BridgeError",
    "ValidationError",
    "CommandNotFoundError",
    "CommandExecutionError",
    "ChannelError",
    "InternalError",
]
