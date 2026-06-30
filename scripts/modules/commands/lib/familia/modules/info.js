import database from "../../../../../core/database.js";

/**
 * @typedef {import("@minecraft/server").Player} Player
 */

/**
 * @typedef {Object} FamiliaName
 * @property {string} abbreviation
 * @property {string} fullName
 */

/**
 * @typedef {Object} FamiliaRelations
 * @property {string} uid
 * @property {"ally" | "enemy" | "neutral"} type
 * @property {number} since
 */

/**
 * @typedef {Object} FamiliaData
 * @property {string} uid
 * @property {"member" | "officer" | "co-leader" | "agent"} rank
 * @property {string} title
 * @property {number} power
 * @property {number} since
 */

/**
 * @typedef {Object} FamiliaPlayer
 * @property {boolean} haveFamilia
 * @property {FamiliaData | null} data
 */

/**
 * @typedef {Object} FamiliaDataStore
 * @property {string} description
 * @property {string[]} tags
 * @property {string} motd
 * @property {string} uid
 * @property {string} founder
 * @property {boolean} open
 * @property {number} since
 * @property {FamiliaRelations[]} relations
 * @property {Record<string, FamiliaData>} members
 * @property {string[]} invites
 * @property {string[]} requests
 * @property {{x:number,y:number,z:number,dimensionId:string}|null} home
 * @property {number} power
 * @property {FamiliaName} name
 */

/**
 * @typedef {Object} FamiliaInfoContext
 * @property {string} [faction]
 */

const FAMILY_DB_KEY = "familia";

/**
 * @param {string} value
 * @returns {atring}
 */
function clean(value) {
	/** @type {atring} */
	return String(value ?? "").trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function lower(value) {
	return clean(value).toLowerCase();
}

/**
 * @param {string} text
 * @returns {string}
 */
function info(text) {
	return `§a${text}§r`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function warn(text) {
	return `§e${text}§r`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function fail(text) {
	return `§c${text}§r`;
}

/**
 * @param {Player} player
 * @param {string} message
 * @returns {void}
 */
function failNow(player, message) {
	player.sendMessage(fail(message));
	player.playSound?.("note.bass");
}

/**
 * @returns {string[]}
 */
function getIndex() {
	return database.get("index", FAMILY_DB_KEY) ?? [];
}

/**
 * @returns {FamiliaDataStore[]}
 */
function getAllFamilias() {
	return getIndex()
		.map(
			uid =>
				/** @type {FamiliaDataStore | undefined} */ (
					database.get(uid, FAMILY_DB_KEY)
				)
		)
		.filter(Boolean)
		.map(family => /** @type {FamiliaDataStore} */ (family));
}

/**
 * @param {string} query
 * @returns {FamiliaDataStore | null}
 */
function findFamilia(query) {
	const q = lower(query);
	if (!q) return null;

	for (const family of getAllFamilias()) {
		if (
			lower(family.uid) === q ||
			lower(family.name?.abbreviation) === q ||
			lower(family.name?.fullName) === q ||
			lower(family.founder) === q ||
			(family.tags ?? []).some(tag => lower(tag) === q) ||
			Object.keys(family.members ?? {}).some(name => lower(name) === q)
		) {
			return family;
		}
	}

	return null;
}

/**
 * @param {Player} player
 * @returns {FamiliaPlayer}
 */
function getPlayerState(player) {
	return (
		/** @type {FamiliaPlayer | undefined} */ (
			database.get("familia", player.name)
		) ?? { haveFamilia: false, data: null }
	);
}

/**
 * @param {Player} player
 * @returns {FamiliaDataStore | null}
 */
function getPlayerFamily(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) return null;
	return (
		/** @type {FamiliaDataStore | undefined} */ (
			database.get(state.data.uid, FAMILY_DB_KEY)
		) ?? null
	);
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string}
 */
function familyPowerText(family) {
	return String(Number(family.power ?? 0));
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string}
 */
function familyMemberText(family) {
	return String(Object.keys(family.members ?? {}).length);
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string}
 */
function familyRelationText(family) {
	const allies = (family.relations ?? []).filter(
		relation => relation.type === "ally"
	).length;
	const enemies = (family.relations ?? []).filter(
		relation => relation.type === "enemy"
	).length;
	const neutrals = (family.relations ?? []).filter(
		relation => relation.type === "neutral"
	).length;
	return `${allies} ally, ${enemies} enemy, ${neutrals} neutral`;
}

/**
 * @param {number | string | Date} value
 * @returns {string}
 */
function formatDate(value) {
	const date = new Date(value);

	/** @param {number} value */
	const pad = value => String(value).padStart(2, "0");

	return (
		`${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())} WIB`
	);
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string[]}
 */
function buildInfoLines(family) {
	return [
		"§6Familia Information§r",
		` §eName: §f${family.name?.fullName ?? family.uid} §7[${family.name?.abbreviation ?? ""}]`,
		` §eUID: §f${family.uid}`,
		` §eFounder: §f${family.founder}`,
		` §eRecruiting: ${family.open ? "§aOpen" : "§cClosed"}`,
		` §eCreated: §f${formatDate(family.since)}`,
		` §eMembers: §f${familyMemberText(family)}`,
		` §ePower: §f${familyPowerText(family)}`,
		` §eRelations: §f${familyRelationText(family)}`,
		` §eMOTD: §f${family.motd || "-"}`,
		` §eDescription: §f${family.description || "-"}`
	];
}

/**
 * Shows detailed information for a Familia.
 * If no faction is provided, it shows the player's current Familia.
 *
 * @param {Player} player
 * @param {FamiliaInfoContext} context
 * @returns {void}
 */
export function showFamiliaInfo(player, context = {}) {
	/** @type {string} */
	const query = clean(context.faction);
	const family = query ? findFamilia(query) : getPlayerFamily(player);

	if (!family) {
		failNow(
			player,
			query ? "Familia not found." : "You are not in a Familia."
		);
		return;
	}

	player.sendMessage(buildInfoLines(family).join("\n"));
}

/**
 * Lists all registered Familias.
 * @param {Player} player
 * @returns {void}
 */
export function listFamilias(player) {
	const families = getAllFamilias();

	if (families.length === 0) {
		player.sendMessage(info("No Familia has been created yet."));
		return;
	}

	const lines = ["§6§lFamilia List§r"];

	for (const family of families.slice(0, 20)) {
		lines.push(
			`§e- §f${family.name?.fullName ?? family.uid} §7[${family.name?.abbreviation ?? ""}] §8(${familyMemberText(family)} members, ${family.open ? "open" : "closed"})`
		);
	}

	if (families.length > 20) {
		lines.push(warn(`Showing first 20 of ${families.length} Familias.`));
	}

	player.sendMessage(lines.join("\n"));
}
