# 🌉 PyBridge

**Bridge Python backends to TypeScript frontends with automatic type-safe client generation.**

PyBridge creates a seamless developer experience for building "Local First" web applications where Python handles the backend logic and TypeScript/React handles the UI. Inspired by PyTauri's command system, but designed for standard web frameworks.

## ✨ Features

- **Zero-Config Command Registry** - Just decorate functions with `@command` and they're automatically registered
- **Automatic TypeScript Generation** - Type-safe client code generated from Python type hints
- **Hot Reload Support** - Changes to Python code automatically regenerate the TypeScript client
- **Streaming/Channels** - Real-time updates via Server-Sent Events
- **Pydantic Integration** - Full support for Pydantic models with automatic interface generation
- **Tree-Shakeable Exports** - Flat function exports for optimal bundling

## 📦 Installation

```bash
pip install pybridge
```

Or with development dependencies:

```bash
pip install pybridge[dev]
```

## 🚀 Quick Start

### 1. Define Your Commands (Python)

```python
# users.py
from pydantic import BaseModel
from pybridge import command

class User(BaseModel):
    id: int
    name: str
    email: str

@command
async def get_user(user_id: int) -> User:
    """Get a user by ID."""
    return User(id=user_id, name="Alice", email="alice@example.com")

@command
async def list_users() -> list[User]:
    """List all users."""
    return [
        User(id=1, name="Alice", email="alice@example.com"),
        User(id=2, name="Bob", email="bob@example.com"),
    ]
```

### 2. Create Your Bridge (Python)

```python
# main.py
from pybridge import Bridge

# Import modules to register their commands (side-effect imports)
import users

app = Bridge(
    generate_ts="../frontend/src/generated/api.ts",
    host="127.0.0.1",
    port=8000,
)

if __name__ == "__main__":
    app.run(dev=True)  # Hot-reload enabled
```

### 3. Use the Generated Client (TypeScript)

```typescript
// Auto-generated in frontend/src/generated/api.ts
import { initBridge } from './generated/api';
import { getUser, listUsers } from './generated/api';

// Initialize connection
initBridge('http://127.0.0.1:8000');

// Type-safe API calls
const user = await getUser({ userId: 123 });
console.log(user.name);  // TypeScript knows this is a string!

const users = await listUsers();
users.forEach(u => console.log(u.email));
```

## 📖 API Reference

### Python API

#### `@command` Decorator

Register a function as a PyBridge command:

```python
from pybridge import command

@command
async def my_command(arg1: str, arg2: int = 10) -> dict:
    """Command docstring becomes JSDoc."""
    return {"result": arg1, "count": arg2}

# With custom name
@command(name="custom_name")
async def internal_function() -> str:
    return "Hello"
```

#### `Bridge` Class

Main server class:

```python
from pybridge import Bridge

app = Bridge(
    generate_ts="../frontend/src/api.ts",  # Where to generate TypeScript
    host="127.0.0.1",                       # Server host
    port=8000,                              # Server port
    cors_origins=["*"],                     # CORS configuration
    title="My API",                         # API title
    debug=False,                            # Debug mode
)

app.run(dev=True)  # dev=True enables hot-reload
```

#### `Channel` for Streaming

Send real-time updates to the frontend:

```python
from pybridge import command, Channel

@command
async def stream_updates(channel: Channel[dict]) -> None:
    """Stream data to the client."""
    for i in range(10):
        await channel.send({"count": i})
        await asyncio.sleep(1)
```

### TypeScript API

#### `initBridge(baseUrl: string)`

Initialize the bridge connection (call once at app startup):

```typescript
import { initBridge } from './generated/api';

initBridge('http://127.0.0.1:8000');
```

#### Generated Functions

Each Python command becomes a TypeScript function:

```typescript
// Python: async def get_user(user_id: int) -> User
// Becomes:
export async function getUser(args: { userId: number }): Promise<User>;
```

#### Error Handling

```typescript
import { getUser, BridgeRequestError } from './generated/api';

try {
    const user = await getUser({ userId: 999 });
} catch (err) {
    if (err instanceof BridgeRequestError) {
        console.error(err.code);    // "EXECUTION_ERROR"
        console.error(err.message); // "User not found"
    }
}
```

#### Streaming Channels

```typescript
import { streamUpdates } from './generated/api';

const channel = streamUpdates({ topic: "news" });

channel.subscribe((data) => {
    console.log("Received:", data);
});

channel.onError((err) => {
    console.error("Stream error:", err);
});

channel.onClose(() => {
    console.log("Stream closed");
});

// Later: close the stream
channel.close();
```

## 🔧 Type Mapping

| Python Type | TypeScript Type |
|-------------|-----------------|
| `str` | `string` |
| `int` | `number` |
| `float` | `number` |
| `bool` | `boolean` |
| `None` | `null` |
| `list[T]` | `T[]` |
| `dict[K, V]` | `Record<K, V>` |
| `Optional[T]` | `T \| null` |
| `BaseModel` | `interface` |

## 🏗️ Project Structure

Recommended project structure:

```
my-project/
├── backend/
│   ├── main.py           # Bridge setup
│   ├── users.py          # User commands
│   ├── products.py       # Product commands
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── generated/
    │   │   ├── api.ts        # Generated (don't edit!)
    │   │   └── _internal.ts  # Generated (don't edit!)
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

## 🔄 Hot Reload Workflow

1. Developer saves `users.py`
2. Uvicorn detects change → reloads Python server
3. On startup, Bridge regenerates `api.ts`
4. Vite detects `api.ts` change → HMR updates the UI

## 🧪 Running the Kitchen Sink Example

```bash
# Clone the repository
git clone https://github.com/pybridge/pybridge
cd pybridge

# Install Python dependencies
pip install -e .

# Start the backend (from examples/kitchen-sink/backend)
cd examples/kitchen-sink/backend
python main.py

# In another terminal, start the frontend
cd examples/kitchen-sink/frontend
npm install
npm run dev
```

Open http://localhost:5173 to see the demo!

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
