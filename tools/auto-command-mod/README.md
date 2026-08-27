# Auto Command — Minecraft Java 26.2

Client-side Fabric mod that automatically sends configurable server commands when player values cross configured thresholds.

## Features

- Auto Feed: sends a configurable command when hunger is at or below the threshold.
- Auto Heal: sends a configurable command when health is at or below the threshold.
- Auto Fix: sends a configurable command when the main-hand item's remaining durability is at or below the threshold percentage.
- Cooldown between automatic commands to prevent command spam.
- Trigger re-arming: a condition must recover above its threshold before that condition can trigger again.
- In-game configuration from Mod Menu using Yet Another Config Lib (YACL).

## Defaults

| Feature | Default threshold | Default command |
| --- | ---: | --- |
| Feed | Hunger <= 10 | `/feed` |
| Heal | Health <= 8.0 | `/heal` |
| Fix | Durability remaining <= 20% | `/fix` |
| Cooldown | 3 seconds | — |

## Dependencies

- Minecraft Java 26.2
- Fabric Loader 0.19.3 or newer
- Fabric API
- Yet Another Config Lib (YACL) 3.9.5+26.2-fabric
- Mod Menu 20.0.0+ (recommended for the config button)

## Installation

Place `auto-command-1.0.0.jar` in the client's `mods` folder together with its dependencies.

Open **Mods → Auto Command → Config** in Mod Menu.

The mod only sends commands through the client connection; it does not grant permissions. The server must already allow `/feed`, `/heal`, and/or `/fix` for the player.
