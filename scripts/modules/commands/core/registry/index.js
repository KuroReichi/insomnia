import { world, system, Player } from "@minecraft/server";
import database from "../../../../core/database";

/**
 * @callback CommandExecutor
 * @param {Player} player
 * @param {CommandContext} args
 * @returns {void|Promise<void>}
 */

/**
 * @typedef {Record<string, any>} CommandContext
 */

/**
 * @typedef {Object} CommandNode
 * @property {"literal"|"argument"} type
 * @property {string} name
 * @property {string} [argType]
 * @property {string[]} [values]
 * @property {CommandExecutor} [run]
 * @property {CommandNode[]} [children]
 */

/**
 * @typedef {Object} Command
 * @property {string} name
 * @property {string[]} [aliases]
 * @property {string} [description]
 * @property {CommandExecutor} [run]
 * @property {CommandNode[]} [children]
 */

/**
 * @typedef {Object} CommandQueueSuccess
 * @property {"Success"} status
 * @property {string} message
 */

/**
 * @typedef {Object} CommandQueueFailure
 * @property {"Failed"} status
 * @property {string} message
 */

/**
 * @typedef {CommandQueueSuccess | CommandQueueFailure} CommandQueueResult
 */

/**
 * @typedef {Object} ValidationSuccess
 * @property {true} success
 * @property {any} value
 */

/**
 * @typedef {Object} ValidationFailure
 * @property {false} success
 * @property {string} error
 */

/**
 * @typedef {ValidationSuccess | ValidationFailure} ValidationResult
 */

/**
 * @typedef {Object} TraversalSuccess
 * @property {true} success
 */

/**
 * @typedef {Object} TraversalFailure
 * @property {false} success
 * @property {string} error
 * @property {string} [token]
 * @property {number} [index]
 */

/**
 * @typedef {TraversalSuccess | TraversalFailure} TraversalResult
 */

/** @type {Map<string, Command>} */
const commandMap = new Map();

/** @type {Map<string, Command>} */
const rootCommands = new Map();

/**
 * Tokenize command input and support quoted arguments.
 *
 * @param {string|string[]} input
 * @returns {string[]}
 */
function tokenizeCommandInput(input) {
	if (Array.isArray(input)) {
		return input.slice();
	}

	if (typeof input !== "string") {
		return [];
	}

	/** @type {string[]} */
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

		if (ch === '"' || ch === "'") {
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

/**
 * @returns {Command[]}
 */
export function getCommands() {
	return [...rootCommands.values()];
}

/**
 * @param {Command} command
 * @returns {void}
 */
export function registerCommand(command) {
	if (commandMap.has(command.name)) {
		return;
	}

	command.aliases ??= [];
	command.children ??= [];

	rootCommands.set(command.name, command);
	commandMap.set(command.name, command);

	for (const alias of command.aliases) {
		if (commandMap.has(alias)) {
			continue;
		}

		commandMap.set(alias, command);
	}
}

/**
 * @param {Player} player
 * @param {string[]} args
 * @param {number} [index]
 * @returns {void}
 */
function sendSyntaxError(player, args, index = Math.max(args.length - 1, 0)) {
	const before = args.slice(0, index).join(" ");
	const wrong = args[index] ?? "";
	const after = args.slice(index + 1).join(" ");

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

/**
 * @param {Player} player
 * @param {Command | CommandNode} node
 * @param {string[]} args
 * @param {number} index
 * @param {CommandContext} context
 * @returns {Promise<TraversalResult>}
 */
async function traverse(player, node, args, index, context) {
	if (index >= args.length) {
		if (node.run) {
			await node.run(player, context);
			return { success: true };
		}

		return {
			success: false,
			error: "syntax",
			token: "",
			index: Math.max(index - 1, 0)
		};
	}

	const token = args[index].toLowerCase();

	const literal = node.children?.find(
		/**
		 * @param {CommandNode} n
		 */
		n => n.type === "literal" && n.name === token
	);

	if (literal) {
		return traverse(player, literal, args, index + 1, context);
	}

	const argument = node.children?.find(
		/**
		 * @param {CommandNode} n
		 */
		n => n.type === "argument"
	);

	if (argument) {
		const parsed = validateArgument(player, argument, args[index]);

		if (!parsed.success) {
			return {
				success: false,
				error: parsed.error,
				token: args[index],
				index
			};
		}

		context[argument.name] = parsed.value;
		return traverse(player, argument, args, index + 1, context);
	}

	return { success: false, error: "syntax", token: args[index], index };
}

/**
 * Accepts either:
 * - raw command string: `fam create "Central Abyss"`
 * - token array: `["fam", "create", "Central Abyss"]`
 *
 * @param {Player} player
 * @param {string|string[]} input
 * @returns {Promise<CommandQueueResult>}
 */
export function CommandQueue(player, input) {
	return new Promise(resolve => {
		system.runTimeout(async () => {
			const args = tokenizeCommandInput(input);
			const name = args[0]?.toLowerCase();

			if (!name) {
				player.sendMessage({
					rawtext: [
						{ text: "§c" },
						{
							translate: "commands.generic.unknown",
							with: ["§7§c"]
						}
					]
				});

				player.playSound("note.bass");

				return resolve({
					status: "Failed",
					message: "Unknown command"
				});
			}

			/** @type {Command | undefined} */
			const command = commandMap.get(name);

			if (!command) {
				player.sendMessage({
					rawtext: [
						{ text: "§c" },
						{
							translate: "commands.generic.unknown",
							with: [`§7${name}§c`]
						}
					]
				});

				player.playSound("note.bass");

				return resolve({
					status: "Failed",
					message: "Unknown command"
				});
			}

			const success = await traverse(player, command, args, 1, {});

			if (!success.success) {
				sendSyntaxError(player, args, success.index);
				player.playSound("note.bass");

				return resolve({
					status: "Failed",
					message: "Invalid usage"
				});
			}

			resolve({
				status: "Success",
				message: `Running /${command.name}`
			});
		}, 5);
	});
}

/**
 * @param {Player} player
 * @param {CommandNode} argument
 * @param {string} value
 * @returns {ValidationResult}
 */
function validateArgument(player, argument, value) {
	switch (argument.argType) {
		case "string":
			return { success: true, value };

		case "number": {
			const num = Number(value);

			if (Number.isNaN(num)) {
				player.sendMessage({
					rawtext: [
						{ text: "§c" },
						{
							translate: "commands.generic.num.invalid",
							with: [`§7${value}§c`]
						}
					]
				});

				return { success: false, error: "number" };
			}

			return { success: true, value: num };
		}

		case "boolean":
			if (value === "true" || value === "false") {
				return { success: true, value: value === "true" };
			}
			return { success: false, error: "boolean" };

		case "player": {
			const target = [...world.getPlayers()].find(
				/**
				 * @param {Player} p
				 */
				p => p.name.toLowerCase() === value.toLowerCase()
			);

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

		case "playerName": {
			/** @type {string[]} */
			const registered = database.get("player.registered") ?? [];
			const name = registered.find(
				/**
				 * @param {string} p
				 */
				p => p.toLowerCase() === value.toLowerCase()
			);

			if (!name) {
				player.sendMessage({
					rawtext: [{ text: "§cUnknown registered player." }]
				});

				return {
					success: false,
					error: "playerName"
				};
			}

			return {
				success: true,
				value: name
			};
		}

		case "enum":
			if (argument.values?.includes(value)) {
				return { success: true, value };
			}
			return { success: false, error: "enum" };

		default:
			return { success: true, value };
	}
}
