"""
TypeScript Generator Module

Generates strictly-typed TypeScript client code from Python command definitions.
Handles Pydantic model conversion and produces tree-shakeable exports.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import (
    Any,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from pydantic import BaseModel

from .registry import CommandInfo, get_registry

logger = logging.getLogger(__name__)


# Python to TypeScript type mapping
PYTHON_TO_TS_TYPES: dict[Any, str] = {
    str: "string",
    int: "number",
    float: "number",
    bool: "boolean",
    bytes: "string",  # Base64 encoded
    type(None): "null",
    None: "null",
}


def python_name_to_camel_case(name: str) -> str:
    """Convert snake_case to camelCase."""
    components = name.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def python_name_to_pascal_case(name: str) -> str:
    """Convert snake_case to PascalCase."""
    return "".join(x.title() for x in name.split("_"))


class TypeScriptGenerator:
    """
    Generates TypeScript client code from PyBridge command registry.

    Features:
    - Converts Pydantic models to TypeScript interfaces
    - Generates flat function exports for tree-shaking
    - Handles Optional, List, Dict types
    - Generates internal bridge utilities
    """

    def __init__(self):
        self._generated_models: set[str] = set()
        self._model_dependencies: dict[str, set[str]] = {}

    def _type_to_ts(self, type_hint: Any, models_to_generate: set[str]) -> str:
        """
        Convert a Python type hint to TypeScript type.

        Args:
            type_hint: The Python type hint.
            models_to_generate: Set to collect Pydantic model names that need generation.

        Returns:
            The TypeScript type string.
        """
        if type_hint is None:
            return "void"

        # Check direct type mapping
        if type_hint in PYTHON_TO_TS_TYPES:
            return PYTHON_TO_TS_TYPES[type_hint]

        # Handle Any
        if type_hint is Any:
            return "unknown"

        # Get origin for generic types
        origin = get_origin(type_hint)
        args = get_args(type_hint)

        # Handle Optional (Union with None)
        if origin is Union:
            non_none_args = [a for a in args if a is not type(None)]
            if len(non_none_args) == 1 and type(None) in args:
                # This is Optional[X]
                inner = self._type_to_ts(non_none_args[0], models_to_generate)
                return f"{inner} | null"
            else:
                # General Union
                ts_types = [self._type_to_ts(a, models_to_generate) for a in args]
                return " | ".join(ts_types)

        # Handle List
        if origin is list:
            if args:
                inner = self._type_to_ts(args[0], models_to_generate)
                return f"{inner}[]"
            return "unknown[]"

        # Handle Dict
        if origin is dict:
            if len(args) >= 2:
                key_type = self._type_to_ts(args[0], models_to_generate)
                value_type = self._type_to_ts(args[1], models_to_generate)
                # TypeScript only allows string/number as index types
                if key_type not in ("string", "number"):
                    key_type = "string"
                return f"Record<{key_type}, {value_type}>"
            return "Record<string, unknown>"

        # Handle Tuple
        if origin is tuple:
            if args:
                inner_types = [self._type_to_ts(a, models_to_generate) for a in args]
                return f"[{', '.join(inner_types)}]"
            return "unknown[]"

        # Handle Set (convert to array in TS)
        if origin is set:
            if args:
                inner = self._type_to_ts(args[0], models_to_generate)
                return f"{inner}[]"
            return "unknown[]"

        # Handle Pydantic models
        if isinstance(type_hint, type) and issubclass(type_hint, BaseModel):
            models_to_generate.add(type_hint.__name__)
            return type_hint.__name__

        # Handle basic types by name
        if isinstance(type_hint, type):
            type_name = type_hint.__name__
            if type_name in PYTHON_TO_TS_TYPES:
                return PYTHON_TO_TS_TYPES[type_hint]
            # Could be a forward reference or custom class
            return "unknown"

        # Default fallback
        return "unknown"

    def _generate_model_interface(
        self,
        model: type[BaseModel],
        models_to_generate: set[str],
    ) -> str:
        """
        Generate TypeScript interface for a Pydantic model.

        Args:
            model: The Pydantic model class.
            models_to_generate: Set to collect nested model names.

        Returns:
            TypeScript interface definition string.
        """
        lines = []

        # Add docstring as JSDoc if available
        if model.__doc__:
            lines.append("/**")
            for line in model.__doc__.strip().split("\n"):
                lines.append(f" * {line.strip()}")
            lines.append(" */")

        lines.append(f"export interface {model.__name__} {{")

        for field_name, field_info in model.model_fields.items():
            ts_name = python_name_to_camel_case(field_name)
            ts_type = self._type_to_ts(field_info.annotation, models_to_generate)

            # Check if optional (has default or is Optional type)
            is_optional = (
                not field_info.is_required() or
                get_origin(field_info.annotation) is Union and
                type(None) in get_args(field_info.annotation)
            )

            optional_mark = "?" if is_optional else ""

            # Add field description as comment
            description = field_info.description
            if description:
                lines.append(f"    /** {description} */")

            lines.append(f"    {ts_name}{optional_mark}: {ts_type};")

        lines.append("}")
        return "\n".join(lines)

    def _generate_command_function(
        self,
        cmd: CommandInfo,
        models_to_generate: set[str],
    ) -> str:
        """
        Generate TypeScript function for a command.

        Args:
            cmd: The command info.
            models_to_generate: Set to collect model names.

        Returns:
            TypeScript function definition string.
        """
        lines = []

        # Function name (convert to camelCase)
        fn_name = python_name_to_camel_case(cmd.name)

        # Generate parameter interface if there are params
        params_type = "void"
        if cmd.params:
            param_fields = []
            for param_name, param_type in cmd.params.items():
                ts_param_name = python_name_to_camel_case(param_name)
                ts_type = self._type_to_ts(param_type, models_to_generate)
                param_fields.append(f"{ts_param_name}: {ts_type}")
            params_type = "{ " + "; ".join(param_fields) + " }"

        # Return type - for channel commands, extract from Channel[T]
        if cmd.has_channel:
            # Try to get the channel's generic type from the function
            channel_type = "unknown"
            hints = {}
            try:
                hints = get_type_hints(cmd.func)
            except Exception:
                pass

            channel_hint = hints.get("channel")
            if channel_hint:
                args = get_args(channel_hint)
                if args:
                    channel_type = self._type_to_ts(args[0], models_to_generate)
            return_type = channel_type
        else:
            return_type = self._type_to_ts(cmd.return_type, models_to_generate)
            if return_type == "void" or return_type == "null":
                return_type = "void"

        # Add JSDoc
        if cmd.docstring:
            lines.append("/**")
            for line in cmd.docstring.strip().split("\n"):
                lines.append(f" * {line.strip()}")
            lines.append(" */")

        # Generate function
        if cmd.has_channel:
            # Streaming function - returns a channel subscription
            if cmd.params:
                lines.append(
                    f"export function {fn_name}(args: {params_type}): "
                    f"BridgeChannel<{return_type}> {{"
                )
                lines.append(f'    return createChannel("{cmd.name}", args);')
            else:
                lines.append(
                    f"export function {fn_name}(): BridgeChannel<{return_type}> {{"
                )
                lines.append(f'    return createChannel("{cmd.name}", {{}});')
            lines.append("}")
        else:
            # Regular async function
            if cmd.params:
                lines.append(
                    f"export async function {fn_name}(args: {params_type}): "
                    f"Promise<{return_type}> {{"
                )
                lines.append(f'    return request("{cmd.name}", args);')
            else:
                lines.append(
                    f"export async function {fn_name}(): Promise<{return_type}> {{"
                )
                lines.append(f'    return request("{cmd.name}", {{}});')
            lines.append("}")

        return "\n".join(lines)

    def _generate_internal_module(self) -> str:
        """Generate the internal bridge utilities module."""
        return '''// Internal bridge utilities - do not modify
let _baseUrl: string | null = null;

export interface BridgeError {
    code: string;
    message: string;
    details?: unknown;
}

export class BridgeRequestError extends Error {
    code: string;
    details?: unknown;

    constructor(error: BridgeError) {
        super(error.message);
        this.name = "BridgeRequestError";
        this.code = error.code;
        this.details = error.details;
    }
}

export interface BridgeChannel<T> {
    subscribe(callback: (data: T) => void): void;
    onError(callback: (error: BridgeError) => void): void;
    onClose(callback: () => void): void;
    close(): void;
}

export function initBridge(baseUrl: string): void {
    _baseUrl = baseUrl.replace(/\\/$/, "");
    console.log(`[PyBridge] Initialized with base URL: ${_baseUrl}`);
}

export function getBaseUrl(): string {
    if (!_baseUrl) {
        throw new Error(
            "[PyBridge] Bridge not initialized. Call initBridge(url) first."
        );
    }
    return _baseUrl;
}

function convertKeysToSnakeCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
            result[snakeKey] = convertKeysToSnakeCase(value);
        }
        return result;
    }
    return obj;
}

function convertKeysToCamelCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            result[camelKey] = convertKeysToCamelCase(value);
        }
        return result;
    }
    return obj;
}

export async function request<T>(command: string, args: unknown): Promise<T> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/command/${command}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(convertKeysToSnakeCase(args)),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new BridgeRequestError({
            code: data.code || "UNKNOWN_ERROR",
            message: data.message || "An unknown error occurred",
            details: data.details,
        });
    }

    return convertKeysToCamelCase(data.result) as T;
}

export function createChannel<T>(command: string, args: unknown): BridgeChannel<T> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/channel/${command}`;

    let eventSource: EventSource | null = null;
    let messageCallback: ((data: T) => void) | null = null;
    let errorCallback: ((error: BridgeError) => void) | null = null;
    let closeCallback: (() => void) | null = null;

    // Start the SSE connection
    const startConnection = async () => {
        // First, initiate the channel via POST
        const initResponse = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(convertKeysToSnakeCase(args)),
        });

        if (!initResponse.ok) {
            const data = await initResponse.json();
            if (errorCallback) {
                errorCallback({
                    code: data.code || "CHANNEL_INIT_ERROR",
                    message: data.message || "Failed to initialize channel",
                    details: data.details,
                });
            }
            return;
        }

        const { channelId } = await initResponse.json();

        // Now connect to SSE endpoint
        eventSource = new EventSource(`${baseUrl}/channel/stream/${channelId}`);

        eventSource.addEventListener("message", (event) => {
            if (messageCallback) {
                const data = JSON.parse(event.data);
                messageCallback(convertKeysToCamelCase(data) as T);
            }
        });

        eventSource.addEventListener("error", (event) => {
            if (errorCallback) {
                errorCallback({
                    code: "CHANNEL_ERROR",
                    message: "Channel connection error",
                });
            }
        });

        eventSource.addEventListener("close", () => {
            if (closeCallback) {
                closeCallback();
            }
            eventSource?.close();
        });
    };

    // Start connection immediately
    startConnection();

    return {
        subscribe(callback: (data: T) => void): void {
            messageCallback = callback;
        },
        onError(callback: (error: BridgeError) => void): void {
            errorCallback = callback;
        },
        onClose(callback: () => void): void {
            closeCallback = callback;
        },
        close(): void {
            eventSource?.close();
            if (closeCallback) {
                closeCallback();
            }
        },
    };
}
'''

    def generate(self, output_path: str) -> None:
        """
        Generate the complete TypeScript client file.

        Args:
            output_path: Path where the TypeScript file will be written.
        """
        registry = get_registry()
        commands = registry.get_all_commands()
        models = registry.get_all_models()

        if not commands:
            logger.warning("No commands registered. Generating empty client.")

        output_path = Path(output_path)
        output_dir = output_path.parent

        # Create output directory if needed
        output_dir.mkdir(parents=True, exist_ok=True)

        # Generate internal module
        internal_path = output_dir / "_internal.ts"
        with open(internal_path, "w") as f:
            f.write(self._generate_internal_module())
        logger.debug(f"Generated internal module: {internal_path}")

        # Collect all models needed
        models_to_generate: set[str] = set()

        # Build the main file content
        sections: list[str] = []

        # Header
        sections.append(f"""/* Auto-generated by PyBridge - DO NOT EDIT */
/* Generated: {datetime.now().isoformat()} */

import {{ initBridge, request, createChannel, BridgeRequestError }} from "./_internal";
import type {{ BridgeChannel, BridgeError }} from "./_internal";

// Re-export initialization and error types
export {{ initBridge, BridgeRequestError }};
export type {{ BridgeChannel, BridgeError }};
""")

        # Generate command functions first to collect all needed models
        command_functions: list[str] = []
        for cmd in sorted(commands.values(), key=lambda c: c.name):
            fn_code = self._generate_command_function(cmd, models_to_generate)
            command_functions.append(fn_code)

        # Also collect models from the model registry
        for model_name, model in models.items():
            models_to_generate.add(model_name)

        # Generate interfaces for all collected models
        generated_models: set[str] = set()
        model_interfaces: list[str] = []

        # Keep generating until all dependencies are resolved
        while models_to_generate - generated_models:
            current_batch = models_to_generate - generated_models
            for model_name in sorted(current_batch):
                model = models.get(model_name)
                if model:
                    interface_code = self._generate_model_interface(model, models_to_generate)
                    model_interfaces.append(interface_code)
                generated_models.add(model_name)

        # Add interfaces section
        if model_interfaces:
            sections.append("// ============ Interfaces ============\n")
            sections.append("\n\n".join(model_interfaces))
            sections.append("")

        # Add functions section
        if command_functions:
            sections.append("\n// ============ Commands ============\n")
            sections.append("\n\n".join(command_functions))

        # Write the main file
        content = "\n".join(sections)
        with open(output_path, "w") as f:
            f.write(content)

        logger.debug(
            f"Generated TypeScript client: {output_path} "
            f"({len(commands)} commands, {len(generated_models)} interfaces)"
        )


def generate_typescript(output_path: str) -> None:
    """
    Generate TypeScript client code.

    Args:
        output_path: Path where the TypeScript file will be written.
    """
    generator = TypeScriptGenerator()
    generator.generate(output_path)
