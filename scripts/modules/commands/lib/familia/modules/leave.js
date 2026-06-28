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
 * @param {string} uid
 * @returns {void}
 */
function deleteFamily(uid) {
	database.delete(uid, FAMILY_DB_KEY);
	saveIndex(getIndex().filter(id => id !== uid));
}

/**
 * @param {FamiliaDataStore} family
 * @param {string} playerName
 * @returns {boolean}
 */
function hasMember(family, playerName) {
	return Boolean(Object.keys(family.members ?? {}).find(name => lower(name) === lower(playerName)));
}

/**
 * Leaves the current Familia.
 * If the player is the leader and the Familia still has other members, the leave action is denied.
 * If the player is the last member, the Familia is deleted.
 *
 * @param {Player} player
 * @returns {void}
 */
export function leaveFamilia(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	const family = findFamilia(state.data.uid);
	if (!family) {
		clearPlayerState(player.name);
		failNow(player, "Your Familia data was missing and has been reset.");
		return;
	}

	const member = family.members?.[player.name];
	const rank = member?.rank ?? state.data.rank ?? "member";
	const memberCount = Object.keys(family.members ?? {}).length;

	if (rank === "agent" && memberCount > 1) {
		failNow(player, "Transfer leadership or disband the Familia first.");
		return;
	}

	delete family.members[player.name];
	clearPlayerState(player.name);

	if (Object.keys(family.members).length === 0) {
		deleteFamily(family.uid);
		player.sendMessage(warn("You left and the Familia has been disbanded because it had no members left."));
		return;
	}

	saveFamily(family);
	player.sendMessage(info("You have successfully left your Familia."));
}
