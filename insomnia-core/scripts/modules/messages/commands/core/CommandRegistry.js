import { system, world } from "@minecraft/server";
import { configs } from "../../../../core/Configuration.js";
import { Database } from "../../../../core/Database.js";
const database = new Database();
const CommandMap = new Map();
const RootCommands = new Map();
function tokenizeCommandInput(input) {
    if (Array.isArray(input)) {
        return input.slice();
    }
    if (typeof input !== "string") {
        return [];
    }
    const tokens = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (ch === "\\") {
                const next = input[i + 1];
                if (next === quote || next === "\\") {
                    current += next;
                    i++;
                    continue;
                }
            }
            if (ch === quote) {
                quote = null;
                continue;
            }
            current += ch;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            if (current.length > 0) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        current += ch;
    }
    if (current.length > 0) {
        tokens.push(current);
    }
    return tokens;
}
export function getCommands() {
    return [...RootCommands.values()];
}
export function registerCommand(data) {
    const commandName = String(data.name ?? "")
        .trim()
        .toLowerCase();
    if (!commandName)
        return;
    if (CommandMap.has(commandName))
        return;
    const entry = {
        name: commandName,
        aliases: data.aliases ?? [],
        description: data.description,
        children: data.children ?? [],
        callback: data.callback
    };
    RootCommands.set(commandName, entry);
    CommandMap.set(commandName, entry);
    for (const alias of entry.aliases ?? []) {
        const normalizedAlias = String(alias ?? "")
            .trim()
            .toLowerCase();
        if (!normalizedAlias)
            continue;
        if (CommandMap.has(normalizedAlias))
            continue;
        CommandMap.set(normalizedAlias, entry);
    }
}
function isValidationFailure(value) {
    return value.success === false;
}
function isTraversalFailure(value) {
    return value.success === false;
}
function sendSyntaxError(player, args, index = Math.max(args.length - 1, 0)) {
    const safeIndex = Math.max(0, Math.min(index, Math.max(args.length - 1, 0)));
    const before = args.slice(0, safeIndex).join(" ");
    const wrong = args[safeIndex] ?? "";
    const after = args.slice(safeIndex + 1).join(" ");
    player.sendMessage({
        rawtext: [
            { text: "§c" },
            {
                translate: "commands.generic.syntax",
                with: [`§7${before}§c`, `§e${wrong}§c`, `§7${after}§c`]
            }
        ]
    });
}
function sendUnknownCommand(player, message) {
    player.sendMessage({
        rawtext: [
            { text: "§c" },
            {
                translate: "commands.generic.unknown",
                with: [`§7${message}§c`]
            }
        ]
    });
}
function validateArgument(player, argument, value) {
    switch (argument.paramType) {
        case "String":
            return { success: true, value };
        case "Float": {
            const num = Number(value);
            if (!Number.isFinite(num)) {
                player.sendMessage({
                    rawtext: [
                        { text: "§c" },
                        {
                            translate: "commands.generic.num.invalid",
                            with: [`§7${value}§c`]
                        }
                    ]
                });
                return { success: false, error: "float" };
            }
            return { success: true, value: num };
        }
        case "Int": {
            const num = Number(value);
            if (!Number.isFinite(num) || !Number.isInteger(num)) {
                player.sendMessage({
                    rawtext: [
                        { text: "§c" },
                        {
                            translate: "commands.generic.num.invalid",
                            with: [`§7${value}§c`]
                        }
                    ]
                });
                return { success: false, error: "int" };
            }
            return { success: true, value: num };
        }
        case "Player": {
            const target = world
                .getAllPlayers()
                .find((p) => p.name.toLowerCase() === value.toLowerCase());
            if (!target) {
                player.sendMessage({
                    rawtext: [
                        { text: "§c" },
                        {
                            translate: "commands.generic.player.notFound"
                        }
                    ]
                });
                return { success: false, error: "player" };
            }
            return { success: true, value: target };
        }
        case "PlayerName": {
            const registeredRaw = database.get("player.registered");
            const registered = Array.isArray(registeredRaw)
                ? registeredRaw.filter((v) => typeof v === "string")
                : [];
            const name = registered.find((p) => p.toLowerCase() === value.toLowerCase());
            if (!name) {
                player.sendMessage({
                    rawtext: [{ text: "§cUnknown registered player." }]
                });
                return { success: false, error: "playerName" };
            }
            return { success: true, value: name };
        }
        case "Enum":
            if (argument.values?.includes(value)) {
                return { success: true, value };
            }
            return { success: false, error: "enum" };
        default:
            return { success: true, value };
    }
}
async function traverse(player, node, args, index, context) {
    const children = node.children ?? [];
    if (index >= args.length) {
        if (node.callback) {
            await node.callback({ player, args: context });
            return { success: true };
        }
        return {
            success: false,
            error: "syntax",
            token: "",
            index: Math.max(index - 1, 0)
        };
    }
    const token = args[index];
    const lowerToken = token.toLowerCase();
    const literal = children.find((n) => n.type === "literal" && n.name.toLowerCase() === lowerToken);
    if (literal) {
        return traverse(player, literal, args, index + 1, context);
    }
    const argument = children.find((n) => n.type === "argument");
    if (argument) {
        const parsed = validateArgument(player, argument, token);
        if (isValidationFailure(parsed)) {
            return {
                success: false,
                error: parsed.error,
                token,
                index
            };
        }
        context[argument.name] = parsed.value;
        return traverse(player, argument, args, index + 1, context);
    }
    if (node.callback) {
        await node.callback({ player, args: context });
        return { success: true };
    }
    return {
        success: false,
        error: "syntax",
        token,
        index
    };
}
export function CommandQueue(player, input) {
    return new Promise((resolve) => {
        system.runTimeout(() => {
            void (async () => {
                const args = tokenizeCommandInput(input);
                const name = args[0]?.toLowerCase();
                if (!name) {
                    sendUnknownCommand(player, "");
                    player.playSound("note.bass");
                    return resolve({
                        status: "Failed",
                        message: "Unknown command"
                    });
                }
                const command = CommandMap.get(name);
                if (!command) {
                    sendUnknownCommand(player, name);
                    player.playSound("note.bass");
                    return resolve({
                        status: "Failed",
                        message: "Unknown command"
                    });
                }
                const result = await traverse(player, command, args, 1, {});
                if (isTraversalFailure(result)) {
                    sendSyntaxError(player, args, result.index);
                    player.playSound("note.bass");
                    return resolve({
                        status: "Failed",
                        message: "Invalid usage"
                    });
                }
                resolve({
                    status: "Success",
                    message: `Running ${String(configs["command.prefix"] ?? "!")}${command.name}`
                });
            })();
        }, 1);
    });
}
