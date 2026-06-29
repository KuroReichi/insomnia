import { Player } from "@minecraft/server";
import { registerCommand, getCommands } from "../../core//registry/index.js";
import { configs } from "../../../../core/configs.js";

/**
 * @callback CommandExecutor
 * @param {import("@minecraft/server").Player} player
 * @param {any} args
 * @returns {void}
 */

/**
 * @typedef {Object} CommandNode
 * @property {"literal"|"argument"} type
 * @property {string} name
 * @property {string} [argType]
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
 * @typedef {Object} Suggestion
 * @property {string} name
 * @property {number} score
 */

/**
 * @typedef {Object} HelpArgs
 * @property {string} query
 */

const PAGE_SIZE = 10;
const prefix = configs.commandPrefix;

export let cacheVersion = 0;

let lastVersion = -1;

/** @type {Command[] | null} */
let cachedCommands = null;

/**
 * @name bumpCommandVersion
 * @returns {void}
 */
export function bumpCommandVersion() {
	cacheVersion++;
}

/**
 * @name getSortedCommands
 * @returns {Command[]}
 */
function getSortedCommands() {
	if (lastVersion !== cacheVersion) {
		cachedCommands = getCommands()
			.slice()
			.sort(
				/**
				 * @param {Command} a
				 * @param {Command} b
				 */
				(a, b) =>
					a.name.localeCompare(b.name, undefined, {
						sensitivity: "base"
					})
			);

		lastVersion = cacheVersion;
	}

	return cachedCommands ?? [];
}

/**
 * @name highlightMatch
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightMatch(text, query) {
	const lower = text.toLowerCase();
	const q = query.toLowerCase();
	const i = lower.indexOf(q);

	if (i === -1) {
		return text;
	}

	return (
		text.slice(0, i) +
		"§e" +
		text.slice(i, i + query.length) +
		"§r§f" +
		text.slice(i + query.length)
	);
}

/**
 * @name buildUsages
 * @param {Command|CommandNode} node
 * @param {string[]} [path=[]]
 * @returns {string[]}
 */
function buildUsages(node, path = []) {
	/** @type {string[]} */
	const usages = [];

	if (node.run) {
		usages.push(path.join(" "));
	}

	if (!node.children || node.children.length === 0) {
		return usages;
	}

	for (const child of node.children) {
		if (child.type === "literal") {
			usages.push(...buildUsages(child, [...path, child.name]));
		} else if (child.type === "argument") {
			usages.push(
				...buildUsages(child, [
					...path,
					`<${child.name}:${child.argType ?? "string"}>`
				])
			);
		}
	}

	return usages;
}

/**
 * @name similarity
 * @param {string} cmdName
 * @param {string} query
 * @returns {number}
 */
function similarity(cmdName, query) {
	const a = cmdName.toLowerCase();
	const b = query.toLowerCase();

	if (!a.length || !b.length) return 0;
	if (a === b) return 999;
	if (Math.abs(a.length - b.length) > 3) return 0;

	let score = 0;

	if (a[0] === b[0]) score += 2;

	if (a.startsWith(b)) {
		score += 10;
	} else if (a.includes(b)) {
		score += 2;
	}

	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] === b[i]) {
			score += 1;
		}
	}

	if (Math.abs(a.length - b.length) <= 2) score += 2;
	if (a.length === b.length) score += 1;

	return score;
}

const MIN_SCORE = 6;

/**
 * @name getSuggestions
 * @param {Command[]} commands
 * @param {string} query
 * @returns {Suggestion[]}
 */
function getSuggestions(commands, query) {
	if (query.length < 2) {
		return [];
	}

	/** @type {Map<string, Suggestion>} */
	const map = new Map();

	for (const cmd of commands) {
		let score = similarity(cmd.name, query);
		const aliases = cmd.aliases ?? [];

		for (const a of aliases) {
			score = Math.max(score, similarity(a, query));
		}

		if (score >= MIN_SCORE) {
			map.set(cmd.name, {
				name: cmd.name,
				score
			});
		}
	}

	return [...map.values()]
		.sort(
			/**
			 * @param {Suggestion} a
			 * @param {Suggestion} b
			 */
			(a, b) =>
				b.score - a.score ||
				a.name.localeCompare(b.name, undefined, {
					sensitivity: "base"
				})
		)
		.slice(0, 5);
}

/**
 * @name helpCommand
 * @param {Player} player
 * @param {HelpArgs} args
 * @returns {void}
 */
export function helpCommand(player, args) {
	const commands = getSortedCommands();
	const arg = args.query;

	if (!arg || (arg && arg === String(parseInt(arg, 10)))) {
		let page = Number(arg) || 1;
		const totalPages = Math.max(Math.ceil(commands.length / PAGE_SIZE), 1);

		if (page > totalPages) page = totalPages;
		if (page < 1) page = 1;

		const start = (page - 1) * PAGE_SIZE;
		const end = start + PAGE_SIZE;
		const list = commands.slice(start, end);

		player.sendMessage(
			`§2--- §aShowing help page §7${page} §aof §7${totalPages} §g(§6${prefix}§ehelp§g) §2---§r`
		);

		for (const cmd of list) {
			const sortedAliases =
				cmd.aliases?.slice().sort(
					/**
					 * @param {string} a
					 * @param {string} b
					 */
					(a, b) =>
						a.localeCompare(b, undefined, { sensitivity: "base" })
				) || [];

			const aliasText = sortedAliases.length
				? ` §2[§a${sortedAliases.join("§7, §a")}§2]§r`
				: "";
			player.sendMessage(
				`  §2» §f${prefix}${cmd.name}${aliasText} §7- §f${cmd.description ?? "No description"}`
			);
		}

		if (totalPages > 1) {
			player.sendMessage(
				`§7Use ${prefix}help <page:int> to navigate pages`
			);
		}

		player.sendMessage(
			`§7Use ${prefix}help <commandName:string> for the details`
		);
		return;
	}

	const name = arg.toLowerCase();

	/** @type {Command | undefined} */
	const command = commands.find(
		/**
		 * @param {Command} c
		 * @returns {boolean}
		 */
		c => c.name === name || (c.aliases ?? []).includes(name)
	);

	if (!command) {
		const suggestions = getSuggestions(commands, name);

		player.sendMessage({
			rawtext: [
				{ text: "§c" },
				{
					translate: "commands.generic.unknown",
					with: [`§7${name}§c`]
				}
			]
		});

		if (suggestions.length > 0) {
			player.sendMessage(" ");
			player.sendMessage("§7Did you mean:");
			player.sendMessage(`§8Showing ${suggestions.length} suggestion(s)`);

			for (const s of suggestions) {
				player.sendMessage(
					`  §e» §f${prefix}${highlightMatch(s.name, name)}`
				);
			}
		}
		return;
	}

	player.sendMessage(`§2--- §aCommand§7: §f${command.name} §2---`);

	if (command.description) {
		player.sendMessage(`§a${command.description}`);
	}

	if (command.aliases?.length) {
		const sortedAliases = command.aliases.slice().sort(
			/**
			 * @param {string} a
			 * @param {string} b
			 */
			(a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
		);

		player.sendMessage(`§aAliases§7: §f${sortedAliases.join(", ")}`);
	}

	const usages = buildUsages(command, [`${prefix}${command.name}`]);

	player.sendMessage("§aUsages:");

	if (usages.length === 0) {
		player.sendMessage({
			rawtext: [{ text: `  §e» §f${prefix}${command.name}` }]
		});
	} else {
		for (const usage of usages) {
			player.sendMessage({
				rawtext: [{ text: `  §e» §f${usage}` }]
			});
		}
	}
}

registerCommand({
	name: "help",
	aliases: ["?"],
	description: "Show command list or command details",
	children: [
		{
			type: "argument",
			name: "query",
			argType: "string",
			run: helpCommand
		}
	],
	run: helpCommand
});
