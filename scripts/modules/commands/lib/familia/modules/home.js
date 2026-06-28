import { world } from "@minecraft/server";
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
 * @param {FamiliaDataStore} family
 * @param {string} playerName
 * @returns {boolean}
 */
function hasMember(family, playerName) {
	return Boolean(Object.keys(family.members ?? {}).find(name => lower(name) === lower(playerName)));
}

/**
 * @param {FamiliaDataStore} family
 * @returns {string}
 */
function familyHomeText(family) {
	if (!family.home) return "This Familia does not have a home yet.";
	return `Home: §f${family.home.x.toFixed(1)}, ${family.home.y.toFixed(1)}, ${family.home.z.toFixed(1)} §7(${family.home.dimensionId})`;
}

/**
 * Teleports the player to the Familia home.
 * @param {Player} player
 * @returns {void}
 */
export function getFamiliaHome(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	const family = findFamilyByUid(state.data.uid);
	if (!family) {
		clearPlayerState(player.name);
		failNow(player, "Your Familia data was missing and has been reset.");
		return;
	}

	if (!family.home) {
		failNow(player, "This Familia does not have a home yet.");
		return;
	}

	const dimension = world.getDimension(family.home.dimensionId || "minecraft:overworld");
	player.teleport({ x: family.home.x, y: family.home.y, z: family.home.z }, { dimension });
	player.sendMessage(info("Teleporting to your Familia home..."));
}

/**
 * Sets the Familia home to the player's current location.
 * @param {Player} player
 * @returns {void}
 */
export function setFamiliaHome(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	const family = findFamilyByUid(state.data.uid);
	if (!family) {
		clearPlayerState(player.name);
		failNow(player, "Your Familia data was missing and has been reset.");
		return;
	}

	const rank = state.data.rank ?? family.members[player.name]?.rank ?? "member";
	if (rank !== "officer" && rank !== "co-leader" && rank !== "agent") {
		failNow(player, "You do not have permission to set the Familia home.");
		return;
	}

	family.home = {
		x: player.location.x,
		y: player.location.y,
		z: player.location.z,
		dimensionId: player.dimension.id
	};

	saveFamily(family);
	player.sendMessage(info(`Successfully updated the Familia home location. ${familyHomeText(family)}`));
}
