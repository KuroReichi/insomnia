# Insomnia Core

<p align="left">
  <img src="https://img.shields.io/badge/Insomnia-5B8CFF?style=for-the-badge&logo=minecraft&logoColor=white" alt="Insomnia">
  <img src="https://wakatime.com/badge/github/KuroReichi/insomnia.svg" alt="WakaTime">
</p>

Insomnia Core is a modular framework for Minecraft Bedrock Edition built on the Script API. It provides a scalable, event-driven architecture for building gameplay systems, managing player data, executing commands, and maintaining persistent storage through Minecraft Dynamic Properties.

Designed with modularity in mind, every subsystem operates independently while remaining connected through a centralized runtime. This architecture makes the project easy to maintain, extend, and integrate with new features without affecting existing modules.

## Architecture

The runtime begins with [scripts/index.js](https://github.com/KuroReichi/insomnia/blob/main/scripts/index.js), which initializes the configuration system, establishes the database connection, and subscribes to Minecraft server events.

Incoming events are dispatched to specialized modules responsible for gameplay mechanics, player tracking, and world management. Meanwhile, chat messages are processed through the command engine, where commands are parsed, validated, and executed before interacting with the database or configuration system.

Every module communicates through a centralized persistence layer, allowing data such as player statistics, economy, guild information, and world states to remain synchronized throughout the server lifecycle.

## Diagram Workflows

```mermaid
flowchart TB
    %% =========================
    %% Styles
    %% =========================
    classDef core fill:#2b2b2b,stroke:#8a8a8a,color:#ffffff,stroke-width:1.5px;
    classDef entry fill:#243b55,stroke:#6fa8dc,color:#ffffff,stroke-width:1.5px;
    classDef input fill:#3b2d5c,stroke:#b39ddb,color:#ffffff,stroke-width:1.5px;
    classDef dispatch fill:#4a3f1d,stroke:#e6c15a,color:#ffffff,stroke-width:1.5px;
    classDef command fill:#1f4d3a,stroke:#7bd389,color:#ffffff,stroke-width:1.2px;
    classDef event fill:#4d1f2f,stroke:#e07a9a,color:#ffffff,stroke-width:1.2px;
    classDef system fill:#234a4d,stroke:#7fd1d8,color:#ffffff,stroke-width:1.2px;
    classDef module fill:#2f2a1f,stroke:#c9b37e,color:#ffffff,stroke-width:1px;
    classDef note fill:#1c1c1c,stroke:#666,color:#dcdcdc,stroke-dasharray: 4 3;

    %% =========================
    %% Core shared state
    %% =========================
    subgraph Core["Shared Core"]
        CFG["core/configs.js\nServer + module config"]:::core
        DB["core/database.js\nDynamicProperty store"]:::core
        UTL["shared utils\nmetrics.js / date.js"]:::core
    end

    %% =========================
    %% Bootstrap
    %% =========================
    subgraph Bootstrap["Bootstrap / Entry"]
        IDX["scripts/index.js\nentrypoint"]:::entry
        LOAD["modules/commands/loader.js\nregister all commands"]:::entry
        CHAT["modules/messages/chat.js\nchat prefix interceptor"]:::input
    end

    IDX --> LOAD
    IDX --> CHAT

    %% =========================
    %% Command input pipeline
    %% =========================
    subgraph CmdFlow["Command Workflow"]
        PREFIX["Prefix check\n! / ? / custom"]:::input
        TOKEN["Tokenize quoted args"]:::dispatch
        QUEUE["CommandQueue(...)"]:::dispatch
        TREE["Registry tree\ncommands/core/registry/index.js"]:::dispatch

        subgraph CmdLibs["Registered Command Libraries"]
            C_FAM["familia/*\ncreate, join, leave,\nhome, relation, manage"]:::command
            C_ECO["economy/*\nmoney, bounty, baltop"]:::command
            C_COM["common/*\nhelp, rtp, playtime, debug"]:::command
        end
    end

    CHAT --> PREFIX --> TOKEN --> QUEUE --> TREE
    LOAD --> TREE
    TREE --> C_FAM
    TREE --> C_ECO
    TREE --> C_COM

    C_FAM --> DB
    C_ECO --> DB
    C_COM --> DB
    C_COM --> CFG

    %% =========================
    %% World / gameplay events
    %% =========================
    subgraph GameEvents["Gameplay Event Workflow"]
        WE["world.beforeEvents / afterEvents"]:::event

        subgraph EventMods["Event Modules"]
            RGN["events/worlds/region-protect.js\nblock/entity/item rules"]:::module
            LIFE["events/worlds/lifesteal.js\nkill, death, hearts, bounty"]:::module
            ECOEV["events/economy/main.js\nbreak/place money flow"]:::module
            FAMEV["events/familia/main.js\nanti-friendly-fire, relations"]:::module
            SPAWN["events/worlds/spawn-data.js\njoin/death state"]:::module
            REAL["events/worlds/realtime.js\nIRL -> world time sync"]:::module
        end
    end

    WE --> RGN
    WE --> LIFE
    WE --> ECOEV
    WE --> FAMEV
    WE --> SPAWN
    WE --> REAL

    RGN --> CFG
    RGN --> DB
    LIFE --> DB
    ECOEV --> DB
    ECOEV --> UTL
    FAMEV --> DB
    SPAWN --> DB
    REAL --> CFG
    REAL --> DB

    %% =========================
    %% Background / interval systems
    %% =========================
    subgraph BgSys["Background Systems"]
        SYS["system.runInterval / runTimeout"]:::system
        NAMETAG["player nametag updater\nbounty + ping + familia"]:::module
        PLAYTIME["player data/playtime.js"]:::module
    end

    SYS --> NAMETAG
    SYS --> PLAYTIME
    NAMETAG --> DB
    NAMETAG --> CFG
    NAMETAG --> UTL
    PLAYTIME --> DB

    %% =========================
    %% Cross-links / practical flow
    %% =========================
    IDX --> WE
    IDX --> SYS
    IDX --> CFG
    IDX --> DB
    TREE --> DB

    %% =========================
    %% Legend / note
    %% =========================
    NOTE["Actual flow summary:\n1) index.js boots and imports side-effect modules\n2) chatSend → CommandQueue → registry → command modules\n3) world events → gameplay modules\n4) system intervals → nametag/playtime/realtime\n5) configs + database are shared state"]:::note

    IDX -.-> NOTE
```