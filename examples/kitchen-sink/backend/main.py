"""
Kitchen Sink Example - Main Entry Point

Demonstrates PyBridge setup with multiple command modules.
"""

from pybridge import Bridge

# Import modules to register their commands (side-effect imports)
import users
import weather
import tasks

# Create the bridge with TypeScript generation configured
app = Bridge(
    generate_ts="../frontend/src/generated/api.ts",
    host="127.0.0.1",
    port=8000,
    title="Kitchen Sink API",
    debug=True,
)

if __name__ == "__main__":
    # dev=True enables:
    # - Uvicorn hot-reloading
    # - TypeScript regeneration on file changes
    app.run(dev=True)
