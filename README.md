# Insomnia Core

Insomnia Core is a modular framework for Minecraft Bedrock Edition built on the Script API. It provides a scalable, event-driven architecture for building gameplay systems, managing player data, executing commands, and maintaining persistent storage through Minecraft Dynamic Properties.

Designed with modularity in mind, every subsystem operates independently while remaining connected through a centralized runtime. This architecture makes the project easy to maintain, extend, and integrate with new features without affecting existing modules.

## Architecture

The runtime begins with `scripts/index.js`, which initializes the configuration system, establishes the database connection, and subscribes to Minecraft server events.

Incoming events are dispatched to specialized modules responsible for gameplay mechanics, player tracking, and world management. Meanwhile, chat messages are processed through the command engine, where commands are parsed, validated, and executed before interacting with the database or configuration system.

Every module communicates through a centralized persistence layer, allowing data such as player statistics, economy, guild information, and world states to remain synchronized throughout the server lifecycle.

## Workflows

```mermaid
graph TD
    %% Core System
    MC((Minecraft\nServer Events))
    Index[scripts/index.js\nMain Entry Point]
    DB[(core/database.js\nDynamic Properties)]
    CFG[core/configs.js\nConfigurations]

    %% Load Core
    Index -->|Initializes| CFG
    Index -->|Reads/Writes| DB
    Index -->|Subscribes| MC

    %% Event Modules
    subgraph Event_Modules [World & Event Handlers]
        Evt_Spawn[Spawn Data\nPlayer Init & Death Tracks]
        Evt_Region[Region Protect\nAnti-Grief, PVP, Block Filter]
        Evt_Lifesteal[Lifesteal System\nBounty, Death Penalty, Hearts]
        Evt_Time[Realtime Sync\nIRL Timezone to MC Ticks]
    end

    %% Data Trackers
    subgraph Data_Trackers [Player Data Tracking]
        Stat_Tracker[Statistics\nBreak, Place, KD, Damage]
        Time_Tracker[Playtime Tracker\nTicks to Days/Hours]
    end

    MC -->|spawn / die / interact| Event_Modules
    MC -->|tick / events| Data_Trackers

    Event_Modules -.->|Save Data| DB
    Data_Trackers -.->|Store Stats| DB
    Event_Modules -.->|Read Settings| CFG

    %% Command Engine
    subgraph Command_System [Command Architecture]
        Chat[messages/chat.js\nChat Listener]
        CmdRegistry{core/registry\nCommand Queue & Parser}

        Cmd_Eco[Economy\nmoney, bounty]
        Cmd_Fam[Familia System\ncreate, join, manage, etc.]
        Cmd_Misc[Common / Utility\nping, help, debug]
    end

    MC -->|beforeEvents.chatSend| Chat
    Chat -->|Prefix Check & Parse| CmdRegistry
    CmdRegistry -->|Execute| Cmd_Eco
    CmdRegistry -->|Execute| Cmd_Fam
    CmdRegistry -->|Execute| Cmd_Misc

    Cmd_Eco -.->|Modify Economy| DB
    Cmd_Fam -.->|Manage Guild Data| DB
    Chat -.->|Read Prefix| CFG

    %% Styling
    classDef core fill:#2d3436,stroke:#dfe6e9,stroke-width:2px,color:#fff;
    classDef db fill:#0984e3,stroke:#74b9ff,stroke-width:2px,color:#fff;
    classDef event fill:#00b894,stroke:#55efc4,stroke-width:2px,color:#fff;
    classDef cmd fill:#d63031,stroke:#ff7675,stroke-width:2px,color:#fff;

    class Index,CFG core;
    class DB db;
    class Evt_Spawn,Evt_Region,Evt_Lifesteal,Evt_Time,Stat_Tracker,Time_Tracker event;
    class Chat,CmdRegistry,Cmd_Eco,Cmd_Fam,Cmd_Misc cmd;
```