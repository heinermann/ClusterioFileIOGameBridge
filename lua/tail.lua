local Tail = {}

function Tail:new(o)
    o = o or {}

    o.pos = 0

    setmetatable(o, self)
    self.__index = self
    return o
end

function Tail:setFile(filename)
    self.filename = filename
end

function Tail:update(line_fn)
    local f = io.open(self.filename, "r")
    if f == nil then return end

    f:setvbuf("no")
    restorePos(self, f)
    readLines(self, f, line_fn)

    f:close()
end

local function restorePos(tail, file)
    local size = file:seek("end")
    if (size < tail.pos) then
        tail.pos = 0
    end
    f:seek("set", tail.pos)
end

local function readLines(tail, file, line_fn)
    for line in file:lines() do
        if line ~= "" then
            line_fn(line)
        end
    end
    tail.pos = file:seek()
end

return Tail
