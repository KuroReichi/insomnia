import { configs } from "../../../../../core/configs.js";
import { getCommands } from "../../../core/registry/index.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

/**
 * @callback CommandExecutor
 * @param {Player} player
 * @param {CommandContext} context
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
 * @typedef {Object} Suggestion
 * @property {string} name
 * @property {number} score
 */

/**
 * @typedef {Object} FamiliaHelpContext
 * @property {string} command
 */

const prefix = configs.commandPrefix;
const PAGE_SIZE = 14;
const MIN_SUGGESTION_SCORE = 6;

/**
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightMatch(text, query) {
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const index = lowerText.indexOf(lowerQuery);

	if (index === -1) {
		return text;
	}

	return (
		text.slice(0, index) +
		"§e" +
		text.slice(index, index + query.length) +
		"§r§f" +
		text.slice(index + query.length)
	);
}

/**
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
	if (a.startsWith(b)) score += 10;
	else if (a.includes(b)) score += 2;

	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] === b[i]) score += 1;
	}

	if (Math.abs(a.length - b.length) <= 2) score += 2;
	if (a.length === b.length) score += 1;

	return score;
}

/**
 * @param {Command[]} commands
 * @param {string} query
 * @returns {Suggestion[]}
 */
function getSuggestions(commands, query) {
	if (query.length < 2) return [];

	/** @type {Map<string, Suggestion>} */
	const map = new Map();

	for (const command of commands) {
		let score = similarity(command.name, query);

		for (const alias of command.aliases ?? []) {
			score = Math.max(score, similarity(alias, query));
		}

		if (score >= MIN_SUGGESTION_SCORE) {
			map.set(command.name, { name: command.name, score });
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
 * @param {CommandNode | Command} node
 * @param {string[]} path
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
			continue;
		}

		if (child.type === "argument") {
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
 * @param {CommandNode | Command} node
 * @param {string} name
 * @returns {CommandNode | Command | null}
 */
function findNode(node, name) {
	if (node.name.toLowerCase() === name.toLowerCase()) {
		return node;
	}

	for (const child of node.children ?? []) {
		const found = findNode(child, name);
		if (found) return found;
	}

	return null;
}

/**
 * @returns {Command | null}
 */
function getFamiliaRoot() {
	return (
		getCommands().find(
			command => command.name.toLowerCase() === "familia"
		) ?? null
	);
}

/**
 * @param {Player} player
 * @param {string} text
 * @returns {void}
 */
function sendLine(player, text) {
	player.sendMessage({ rawtext: [{ text }] });
}

/**
 * @param {Player} player
 * @param {string} message
 * @returns {void}
 */
function sendFail(player, message) {
	player.sendMessage({
		rawtext: [
			{ text: "§c" },
			{
				translate: "commands.generic.unknown",
				with: [`§7${message}§c`]
			}
		]
	});
	player.playSound?.("note.bass");
}

/**
 * Displays command usages for the Familia command tree.
 * It supports page-based browsing and per-command lookup, using the configured prefix.
 *
 * @param {Player} player
 * @param {FamiliaHelpContext} args
 * @returns {void}
 */
export function helpFamilia(player, args = {}) {
	const root = getFamiliaRoot();

	if (!root) {
		sendFail(player, "Familia command is not registered.");
		return;
	}

	const rawQuery = String(args.command ?? "").trim();

	if (!rawQuery || rawQuery === String(parseInt(rawQuery, 10))) {
		let page = Number(rawQuery) || 1;
		const usages = buildUsages(root, [`${prefix}${root.name}`]);
		const totalPages = Math.max(Math.ceil(usages.length / PAGE_SIZE), 1);

		if (page < 1) page = 1;
		if (page > totalPages) page = totalPages;

		const start = (page - 1) * PAGE_SIZE;
		const list = usages.slice(start, start + PAGE_SIZE);

		sendLine(
			player,
			`§2--- §aShowing Familia usage page §7${page} §aof §7${totalPages} §2---§r`
		);

		if (list.length === 0) {
			sendLine(player, `§7No usage found for §f${prefix}${root.name}§7.`);
			return;
		}

		for (const usage of list) {
			sendLine(player, `  §2» §f${usage}`);
		}

		if (totalPages > 1) {
			sendLine(
				player,
				`§7Use ${prefix}familia help <page:int> to navigate pages`
			);
		}

		sendLine(
			player,
			`§7Use ${prefix}familia help <commandName:string> for a specific command`
		);
		return;
	}

	const query = rawQuery.toLowerCase();
	const match = findNode(root, query);

	if (!match) {
		const commands = root.children ?? [];
		const suggestions = getSuggestions(
			commands.map(
				/**
				 * @param {CommandNode} node
				 * @returns {Command}
				 */
				node => ({
					name: node.name,
					aliases:
						node.values?.filter(
							value => typeof value === "string"
						) ?? [],
					children: node.children,
					run: node.run
				})
			),
			query
		);

		sendFail(player, query);

		if (suggestions.length > 0) {
			sendLine(player, " ");
			sendLine(player, "§7Did you mean:");
			sendLine(player, `§8Showing ${suggestions.length} suggestion(s)`);

			for (const suggestion of suggestions) {
				sendLine(
					player,
					`  §e» §f${prefix}${root.name} ${highlightMatch(suggestion.name, query)}`
				);
			}
		}

		return;
	}

	const usages = buildUsages(match, [
		`${prefix}${root.name}`,
		...(match === root ? [] : [match.name])
	]);

	sendLine(
		player,
		`§2--- §aUsages for §f${prefix}${root.name}${match === root ? "" : ` ${match.name}`} §2---`
	);

	if (usages.length === 0) {
		sendLine(
			player,
			`  §e» §f${prefix}${root.name}${match === root ? "" : ` ${match.name}`}`
		);
		return;
	}

	for (const usage of usages) {
		sendLine(player, `  §e» §f${usage}`);
	}
}
