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

const FAMILY_DB_KEY = "familia";

/**
 * @param {string} value
 * @returns {string}
 */
function clean(value) {
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
	return `§a${text}`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function warn(text) {
	return `§e${text}`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function fail(text) {
	return `§c${text}`;
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
 * @param {string[]} list
 * @returns {void}
 */
function saveIndex(list) {
	database.set("index", [...new Set(list)], FAMILY_DB_KEY, true);
}

/**
 * @returns {FamiliaDataStore[]}
 */
function getAllFamilias() {
	return getIndex()
		.map(uid => /** @type {FamiliaDataStore | undefined} */ (database.get(uid, FAMILY_DB_KEY)))
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
 * @param {string} uid
 * @returns {FamiliaDataStore | null}
 */
function findFamilyByUid(uid) {
	return /** @type {FamiliaDataStore | undefined} */ (database.get(uid, FAMILY_DB_KEY)) ?? null;
}

/**
 * @param {Player} player
 * @returns {FamiliaPlayer}
 */
function getPlayerState(player) {
	return /** @type {FamiliaPlayer | undefined} */ (database.get("familia", player.name)) ?? { haveFamilia: false, data: null };
}

/**
 * @param {Player} player
 * @param {FamiliaPlayer} state
 * @returns {void}
 */
function setPlayerState(player, state) {
	database.set("familia", state, player.name, true);
}

/**
 * @param {string} name
 * @returns {void}
 */
function clearPlayerState(name) {
	database.set("familia", { haveFamilia: false, data: null }, name, true);
}

/**
 * @param {FamiliaDataStore} family
 * @returns {void}
 */
function saveFamily(family) {
	family.members ??= {};
	family.invites ??= [];
	family.requests ??= [];
	family.relations ??= [];
	family.tags ??= [];
	family.description ??= "";
	family.motd ??= "";
	family.home ??= null;
	family.power = Object.values(family.members).reduce((sum, member) => sum + Number(member?.power ?? 0), 0);
	family.name ??= { abbreviation: "", fullName: "" };

	database.set(family.uid, family, FAMILY_DB_KEY, true);

	const index = new Set(getIndex());
	index.add(family.uid);
	saveIndex([...index]);
}

/**
 * @param {Player} player
 * @param {FamiliaDataStore} family
 * @param {"member" | "officer" | "co-leader" | "agent"} minRank
 * @returns {boolean}
 */
function canManage(player, family, minRank = "officer") {
	const rank = family.members?.[player.name]?.rank ?? null;
	const score = rank === "member" ? 1 : rank === "officer" ? 2 : rank === "co-leader" ? 3 : rank === "agent" ? 4 : 0;
	const need = minRank === "member" ? 1 : minRank === "officer" ? 2 : minRank === "co-leader" ? 3 : 4;
	return score >= need;
}

/**
 * @param {Player} player
 * @param {string} stateName
 * @returns {FamiliaDataStore | null}
 */
function getPlayerFamily(player, stateName = player.name) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) return null;
	return findFamilyByUid(state.data.uid);
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string}
 */
function familyStatusText(family) {
	return family.open ? "open for public joins" : "closed for public joins";
}

/**
 * Opens the Familia for public joins.
 * @param {Player} player
 * @returns {void}
 */
export function openFamilia(player) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to open the Familia.");
		return;
	}

	family.open = true;
	saveFamily(family);
	player.sendMessage(info(`Familia is now ${familyStatusText(family)}.`));
}

/**
 * Closes the Familia for public joins.
 * @param {Player} player
 * @returns {void}
 */
export function closeFamilia(player) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to close the Familia.");
		return;
	}

	family.open = false;
	saveFamily(family);
	player.sendMessage(info(`Familia is now ${familyStatusText(family)}.`));
}
