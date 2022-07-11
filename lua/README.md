TODO: move this out to its own repo

## Pure Lua Libraries

### Tail (tail.lua)
An update-based tail library. In this repo.

Usage
```lua
local Tail = require "tail"

local tail = Tail:new({ filename = "infile.log" })

-- Some kind of update callback specific to the game
function onGameUpdate()
    tail:update(on_line)
end

local function on_line(line)
    -- do stuff with line (raw string)
end
```

### JSON Library (json.lua)
JSON serializer and deserializer.

See [this external library](https://github.com/rxi/json.lua).

### Class Library (classic.lua)
Class helper library.

See [this external library](https://github.com/rxi/classic).

### String Manipulation
See [Allen](https://github.com/Yonaba/Allen).

