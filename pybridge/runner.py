"""
Runner Module

Provides the run() function for easy server startup with hot-reload support.
Handles Uvicorn configuration and process management.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def run(
    generate_ts: str | None = None,
    host: str = "127.0.0.1",
    port: int = 8000,
    cors_origins: list[str] | None = None,
    title: str = "PyBridge API",
    debug: bool = False,
    dev: bool = False,
    reload_dirs: list[str] | None = None,
    import_modules: list[str] | None = None,
) -> None:
    """
    Run the PyBridge server.

    This is the main entry point for starting a PyBridge application.
    It handles both production and development modes.

    Args:
        generate_ts: Path where TypeScript client will be generated.
        host: Host to bind the server to.
        port: Port to bind the server to.
        cors_origins: List of allowed CORS origins.
        title: API title for documentation.
        debug: Enable debug logging.
        dev: Enable development mode with hot-reloading.
        reload_dirs: Directories to watch for changes (dev mode only).
        import_modules: List of module names containing commands to import.

    Example:
        from pybridge import run

        if __name__ == "__main__":
            run(
                generate_ts="../frontend/src/api.ts",
                dev=True,
                import_modules=["users", "weather"],
            )
    """
    import uvicorn

    from .bridge import Bridge
    from .generator import generate_typescript
    from .registry import get_registry
    from .server import set_config

    # Set configuration for factory mode
    set_config(
        generate_ts=generate_ts,
        host=host,
        port=port,
        cors_origins=cors_origins,
        title=title,
        debug=debug,
        import_modules=import_modules or [],
    )

    # Setup logging
    log_level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Generate TypeScript on initial startup
    if generate_ts:
        try:
            generate_typescript(generate_ts)
            logger.info(f"TypeScript client generated: {generate_ts}")
        except Exception as e:
            logger.error(f"Failed to generate TypeScript client: {e}")

    # Print startup info
    registry = get_registry()
    commands = registry.get_all_commands()

    print(f"\n{'='*50}")
    print(f"  PyBridge - {title}")
    print(f"{'='*50}")
    print(f"  Server:     http://{host}:{port}")
    print(f"  Mode:       {'Development' if dev else 'Production'}")
    print(f"  Commands:   {len(commands)}")
    if generate_ts:
        print(f"  TypeScript: {generate_ts}")
    print(f"{'='*50}\n")

    for cmd in commands.values():
        channel_marker = " [channel]" if cmd.has_channel else ""
        print(f"  • {cmd.name}{channel_marker}")
    print()

    if dev:
        # Development mode with hot-reload
        logger.info("Starting in development mode with hot-reload...")

        # Determine reload directories
        watch_dirs = reload_dirs or ["."]

        # Run with factory pattern for proper reloading
        uvicorn.run(
            "pybridge.server:create_app",
            host=host,
            port=port,
            reload=True,
            reload_dirs=watch_dirs,
            factory=True,
            log_level="debug" if debug else "info",
        )
    else:
        # Production mode
        bridge = Bridge(
            generate_ts=generate_ts,
            host=host,
            port=port,
            cors_origins=cors_origins,
            title=title,
            debug=debug,
        )

        uvicorn.run(
            bridge.app,
            host=host,
            port=port,
            log_level="debug" if debug else "info",
        )
