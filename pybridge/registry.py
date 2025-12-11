"""
Command Registry Module

Provides the @command decorator and global registry for PyBridge commands.
Commands are registered automatically when decorated, enabling zero-config setup.
"""

from __future__ import annotations

import asyncio
import inspect
from typing import Any, Callable, Dict, Optional, Type, get_type_hints
from functools import wraps

from pydantic import BaseModel


class CommandInfo:
    """Stores metadata about a registered command."""
    
    def __init__(
        self,
        name: str,
        func: Callable,
        params: Dict[str, Type],
        return_type: Optional[Type],
        is_async: bool,
        docstring: Optional[str],
        module: str,
        has_channel: bool = False,
    ):
        self.name = name
        self.func = func
        self.params = params
        self.return_type = return_type
        self.is_async = is_async
        self.docstring = docstring
        self.module = module
        self.has_channel = has_channel
    
    def __repr__(self) -> str:
        return f"CommandInfo(name={self.name!r}, module={self.module!r})"


class CommandRegistry:
    """
    Global registry for all PyBridge commands.
    
    Maintains a flat namespace of commands and ensures no duplicates.
    Collects Pydantic models used in command signatures for TS generation.
    """
    
    _instance: Optional[CommandRegistry] = None
    
    def __new__(cls) -> CommandRegistry:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._commands: Dict[str, CommandInfo] = {}
            cls._instance._models: Dict[str, Type[BaseModel]] = {}
            cls._instance._initialized = True
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> CommandRegistry:
        """Get the singleton registry instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @classmethod
    def reset(cls) -> None:
        """Reset the registry (useful for testing)."""
        if cls._instance is not None:
            cls._instance._commands.clear()
            cls._instance._models.clear()
    
    def register(self, cmd: CommandInfo) -> None:
        """
        Register a command.
        
        Raises:
            ValueError: If a command with the same name already exists.
        """
        if cmd.name in self._commands:
            existing = self._commands[cmd.name]
            raise ValueError(
                f"Command name conflict: '{cmd.name}' is defined in both "
                f"'{existing.module}' and '{cmd.module}'. "
                f"Command names must be unique across all modules."
            )
        self._commands[cmd.name] = cmd
    
    def register_model(self, model: Type[BaseModel]) -> None:
        """Register a Pydantic model for TypeScript generation."""
        if model.__name__ not in self._models:
            self._models[model.__name__] = model
    
    def get_command(self, name: str) -> Optional[CommandInfo]:
        """Get a command by name."""
        return self._commands.get(name)
    
    def get_all_commands(self) -> Dict[str, CommandInfo]:
        """Get all registered commands."""
        return self._commands.copy()
    
    def get_all_models(self) -> Dict[str, Type[BaseModel]]:
        """Get all registered Pydantic models."""
        return self._models.copy()
    
    def collect_models_from_type(self, type_hint: Any) -> None:
        """
        Recursively collect Pydantic models from a type hint.
        
        Handles Optional, List, Dict, and nested models.
        """
        if type_hint is None:
            return
        
        origin = getattr(type_hint, "__origin__", None)
        
        # Handle Optional, List, Dict, etc.
        if origin is not None:
            args = getattr(type_hint, "__args__", ())
            for arg in args:
                self.collect_models_from_type(arg)
            return
        
        # Handle Pydantic models
        if isinstance(type_hint, type) and issubclass(type_hint, BaseModel):
            if type_hint.__name__ not in self._models:
                self._models[type_hint.__name__] = type_hint
                # Recursively collect nested models from fields
                for field_name, field_info in type_hint.model_fields.items():
                    self.collect_models_from_type(field_info.annotation)


# Global registry instance
_registry = CommandRegistry.get_instance()


def command(func: Callable = None, *, name: Optional[str] = None) -> Callable:
    """
    Decorator to register a function as a PyBridge command.
    
    Usage:
        @command
        async def get_user(user_id: int) -> User:
            ...
        
        @command(name="custom_name")
        def my_function() -> str:
            ...
    
    Args:
        func: The function to decorate.
        name: Optional custom command name (defaults to function name).
    
    Returns:
        The decorated function.
    """
    def decorator(fn: Callable) -> Callable:
        # Determine command name
        cmd_name = name or fn.__name__
        
        # Get type hints
        try:
            hints = get_type_hints(fn)
        except Exception:
            hints = {}
        
        # Extract parameters (excluding 'return' and 'channel')
        sig = inspect.signature(fn)
        params: Dict[str, Type] = {}
        has_channel = False
        
        for param_name, param in sig.parameters.items():
            if param_name == "channel":
                has_channel = True
                # Collect the Channel's generic type parameter
                channel_type = hints.get("channel")
                if channel_type:
                    from typing import get_args
                    channel_args = get_args(channel_type)
                    if channel_args:
                        _registry.collect_models_from_type(channel_args[0])
                continue
            
            param_type = hints.get(param_name, Any)
            params[param_name] = param_type
            
            # Collect any Pydantic models from parameter types
            _registry.collect_models_from_type(param_type)
        
        # Get return type
        return_type = hints.get("return", None)
        _registry.collect_models_from_type(return_type)
        
        # Check if async
        is_async = asyncio.iscoroutinefunction(fn)
        
        # Get module name
        module = fn.__module__
        
        # Create command info
        cmd_info = CommandInfo(
            name=cmd_name,
            func=fn,
            params=params,
            return_type=return_type,
            is_async=is_async,
            docstring=fn.__doc__,
            module=module,
            has_channel=has_channel,
        )
        
        # Register the command
        _registry.register(cmd_info)
        
        # Preserve the original function
        @wraps(fn)
        async def async_wrapper(*args, **kwargs):
            if is_async:
                return await fn(*args, **kwargs)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))
        
        async_wrapper._pybridge_command = cmd_info
        return async_wrapper
    
    # Handle both @command and @command() syntax
    if func is not None:
        return decorator(func)
    return decorator


def get_registry() -> CommandRegistry:
    """Get the global command registry."""
    return _registry
