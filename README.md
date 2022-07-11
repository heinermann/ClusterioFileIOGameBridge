# Clusterio Universal Game Bridge Plugin

Plugin which uses basic file I/O to communicate with other games. It supports some plugins if they are available.

## Why File I/O?

It's the only reliable, widely supported, standardized mechanism among games that have restricted modding capabilities. In some games such as [Noita](https://noitagame.com/) or [Starbound](https://playstarbound.com/) you can allow unsafe mods to gain access to the [`io`](https://www.lua.org/manual/5.4/manual.html#6.8) library, but there are no other viable communication mechanisms. Other Lua-moddable games such as [Don't Starve](https://www.klei.com/games/dont-starve) allow `io` it by default. It's also extremely easy to implement in a target language (i.e. C#, Java), though it is probably better to later switch to something that has a more direct line of communication.

## How it works

Uses two files, one for sending and another for receiving. Each will write JSONL messages to a designated output file and tail its designated input file. From the perspective of the client the roles are reversed and it reads from the instance plugin's output file.

When enough messages have been written, the slave can send a WIPE message to clear the file data. When it does so it closes the file it writes to and holds all messages. The instance will respond with its own WIPE message and also close its file handles. Once the slave reads the WIPE message from the instance it will erase the file contents and write a status file indicating it is ready to start reading the files again.

## Supported Plugins

### Global Chat
Self-explanatory. Shares chat messages among different games and servers.

### Research Sync
TODO
Synchronizes research between games. Some games which have research include [Oxygen Not Included](https://www.klei.com/games/oxygen-not-included), [Rimworld](https://rimworldgame.com/), and [Satisfactory](https://www.satisfactorygame.com/).

### Subspace Storage
TODO
Transfer items, fluids, and power between games.

For the time being items are not translated directly to their cross-game counterparts. This is because
1. They can contain metadata such as germs and temperature (Oxygen Not Included) or nbt (Minecraft).
2. There is a lot of work to do item association and quantity translation.

Items will be referred using the following string format, inspired by Minecraft:

```
game@namespace:item_name{tags_json}

Examples:

mc@minecraft:sword
mc@minecraft:stone
oni@vanilla:Water{"temperature":32,"germs":15887,"germtype":"food_poisoning"}
```

#### Limitations and Future Work

##### Items
Vanilla Factorio items cannot have metadata associated with it, but an [`item-with-tags`](https://wiki.factorio.com/Prototype/ItemWithTags) can associate tags with an itemstack to ensure proper cross compatibility.

TODO: Consider replacing item types with `item-with-tags`. If that doesn't work, duplicate some of them and create new duplicate smelting recipes that take it which erases the metadata (burned away which is fine).

##### Fluids
Factorio fluids can only have an associated temperature (there are also germs in Oxygen Not Included).

##### Power
Power needs to be translated using some kind of scale. If transferred at a one-to-one ratio, a single Factorio steam engine (900kW) can power several Oxygen Not Included bases (equivalent to 1058+ ONI Steam Turbines).

## Installation

Run the following commands in the folder Clusterio is installed to:

    npm install @heinermann/plugin-fileio_game_bridge
    npx clusteriomaster plugin add @heinermann/plugin-fileio_game_bridge

Substitute clusteriomaster with clusterioslave if this a dedicate slave.

When loaded, add the interface directories associated with each game you want to connect (you will need a mod for each of those games as well).
