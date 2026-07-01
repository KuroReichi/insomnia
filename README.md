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

## Workflows

```mermaid
graph TD
    %% Styling
    classDef core fill:#f9f,stroke:#333,stroke-width:2px;
    classDef db fill:#fca,stroke:#333,stroke-width:2px;
    classDef event fill:#bbf,stroke:#333,stroke-width:2px;
    classDef cmd fill:#bfb,stroke:#333,stroke-width:2px;
    classDef module fill:#ffd,stroke:#333,stroke-width:1px;

    %% --- CORE ---
    subgraph CoreLayer ["Core Layer"]
        DB[("Database\n(core/database.js)")]:::db
        CFG["Configs\n(core/configs.js)"]:::core
    end

    %% --- ENTRY POINT ---
    IDX["index.js\n(Entry Point)"]:::core
    
    %% --- MINECRAFT API EVENTS ---
    subgraph MCApi ["Minecraft API Events"]
        ChatEvt["chatSend\n(messages/chat.js)"]:::event
        WorldEvt["World & Entity Events\n(afterEvents / beforeEvents)"]:::event
        SysInt["System Intervals\n(system.runInterval)"]:::event
    end

    %% --- COMMAND SYSTEM ---
    subgraph CmdSys ["Command System"]
        CmdQueue["Command Queue & Parser\n(registry/index.js)"]:::cmd
        CmdLoader["Command Loader\n(loader.js)"]:::cmd
        
        subgraph CmdLibs ["Command Libraries"]
            CmdFam["Familia\n(Create, Join, Manage, Relation)"]:::module
            CmdEco["Economy\n(Money, Bounty, Baltop)"]:::module
            CmdCom["Common & Debug\n(RTP, Playtime, Help, Debug)"]:::module
        end
    end

    %% --- GAMEPLAY EVENT MODULES ---
    subgraph EventMods ["Gameplay Event Modules"]
        ModLifesteal["Lifesteal\n(Kill/Death, Bounties, Hearts)"]:::module
        ModRegion["Region Protect\n(Block/Entity Protection)"]:::module
        ModEco["Economy Events\n(Block Break/Place Rewards)"]:::module
        ModFam["Familia Events\n(Anti Friendly-Fire)"]:::module
        ModRealtime["Realtime\n(IRL Timezone Sync)"]:::module
        ModSpawn["Spawn Data\n(First Join & Death Tracks)"]:::module
    end

    %% --- PLAYER SYSTEMS ---
    subgraph PlayerSys ["Player Background Systems"]
        SysNametag["Nametag Updater\n(Bounty, Ping, Familia Prefix)"]:::module
        SysPlaytime["Playtime Tracker"]:::module
    end

    %% --- RELATIONSHIPS & FLOW ---
    
    %% Initialization
    IDX --> ChatEvt
    IDX --> WorldEvt
    IDX --> SysInt
    IDX --> CmdLoader

    %% Chat to Commands Workflow
    ChatEvt -- "Intercepts Prefix (!)" --> CmdQueue
    CmdLoader --> CmdQueue
    CmdQueue -- "Executes" --> CmdLibs
    
    %% World Events to Gameplay Modules Workflow
    WorldEvt --> ModLifesteal
    WorldEvt --> ModRegion
    WorldEvt --> ModEco
    WorldEvt --> ModFam
    WorldEvt --> ModSpawn

    %% System Intervals to Background Tasks Workflow
    SysInt --> ModRealtime
    SysInt --> SysNametag
    SysInt --> SysPlaytime

    %% Read/Write to Database
    CmdLibs -. "Read/Write" .-> DB
    ExtLifesteal -. "Read/Write (Money, Bounty)" .-> DB
    ExtRegion -. "Read (Regions)" .-> DB
    ExtEconomy -. "Read/Write (Stats, Money)" .-> DB
    ExtFamilia -. "Read (Relations)" .-> DB
    ExtSpawnData -. "Read/Write (Session)" .-> DB
    PlayerNameSystem -. "Read (Bounty, Familia)" .-> DB
    Playtime -. "Read/Write (Ticks)" .-> DB
    
    RealtimeIntegration -. "Read (Timezone)" .-> CFG
    RegionProtection -. "Read (Configs)" .-> CFG
```