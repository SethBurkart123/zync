# Zynk

A Python-TypeScript bridge with automatic type generation and hot-reloading.

Define commands in Python, get a fully typed TypeScript client for free.

## Installation

```bash
pip install zynk
```

## Usage

Define commands with the `@command` decorator:

```python
# commands.py
from pydantic import BaseModel
from zynk import command

class User(BaseModel):
    id: int
    name: str
    email: str

@command
async def get_user(user_id: int) -> User:
    return User(id=user_id, name="Alice", email="alice@example.com")
```

Create a bridge and run it:

```python
# main.py
from zynk import Bridge
import commands  # registers commands on import

app = Bridge(
    generate_ts="./frontend/src/api.ts",
    port=8000,
)

if __name__ == "__main__":
    app.run(dev=True)
```

Use the generated TypeScript client:

```typescript
import { initBridge, getUser } from './api';

initBridge('http://127.0.0.1:8000');

const user = await getUser({ userId: 123 });
console.log(user.name); // fully typed
```

## Streaming

Use `Channel` to stream data to clients:

```python
from zynk import command, Channel
import asyncio

@command
async def stream_updates(channel: Channel[dict]) -> None:
    for i in range(10):
        await channel.send({"count": i})
        await asyncio.sleep(1)
```

```typescript
const channel = streamUpdates({});

channel.subscribe((data) => console.log(data));
channel.onClose(() => console.log("done"));
```

## License

MIT
