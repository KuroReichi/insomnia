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
 * @typedef {Object} FamiliaCreateContext
 * @property {string} abbreviation
 * @property {string} full
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
 * @returns {number}
 */
function now() {
	return Date.now();
}

/**
 * @returns {string}
 */
function makeUid() {
	return `FAM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
}

/**
 * @param {unknown} value
 * @returns {value is FamiliaPlayer}
 */
function isFamiliaPlayer(value) {
	return Boolean(
		value &&
		typeof value === "object" &&
		"haveFamilia" in value &&
		"data" in value
	);
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
 * @param {string} message
 * @returns {void}
 */
function failNow(player, message) {
	player.sendMessage(fail(message));
	player.playSound?.("note.bass");
}

/**
 * @param {Player} player
 * @returns {FamiliaPlayer}
 */
function getPlayerState(player) {
	const state = /** @type {FamiliaPlayer | undefined} */ (
		database.get("familia", player.name)
	);
	return state ?? { haveFamilia: false, data: null };
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
	family.power = Object.values(family.members).reduce(
		(sum, member) => sum + Number(member?.power ?? 0),
		0
	);
	family.name ??= { abbreviation: "", fullName: "" };

	database.set(family.uid, family, FAMILY_DB_KEY, true);

	const index = new Set(getIndex());
	index.add(family.uid);
	saveIndex([...index]);
}

/**
 * @param {Player} player
 * @param {FamiliaDataStore} family
 * @param {"member" | "officer" | "co-leader" | "agent"} rank
 * @param {string} title
 * @returns {FamiliaData}
 */
function joinFamily(player, family, rank = "member", title = "") {
	/** @type {FamiliaData} */
	const member = {
		uid: family.uid,
		rank,
		title,
		power: 0,
		since: now()
	};

	family.members[player.name] = member;
	family.requests = (family.requests ?? []).filter(
		name => lower(name) !== lower(player.name)
	);
	family.invites = (family.invites ?? []).filter(
		name => lower(name) !== lower(player.name)
	);
	saveFamily(family);
	setPlayerState(player, { haveFamilia: true, data: member });
	return member;
}

/**
 * Handles the creation of a new Familia.
 * @param {Player} player
 * @param {FamiliaCreateContext} context
 * @returns {void}
 */
export function createFamilia(player, context) {
	const abbreviation = clean(context.abbreviation).toUpperCase();
	const full = clean(context.full);

	if (!abbreviation || !full) {
		failNow(
			player,
			"Invalid or missing arguments. Type §e!familia help§c for proper command usage."
		);
		return;
	}

	if (abbreviation.length > 5) {
		failNow(player, "Abbreviation must be at most 5 characters.");
		return;
	}

	if (full.length > 28) {
		failNow(player, "Full name must be at most 28 characters.");
		return;
	}

	if (getPlayerState(player).haveFamilia) {
		failNow(player, "You already belong to a Familia.");
		return;
	}

	const clash = findFamilia(abbreviation) ?? findFamilia(full);
	if (clash) {
		failNow(
			player,
			"A Familia with the same abbreviation or full name already exists."
		);
		return;
	}

	/** @type {FamiliaDataStore} */
	const family = {
		uid: makeUid(),
		name: {
			abbreviation,
			fullName: full
		},
		description: "",
		tags: [],
		motd: "",
		founder: player.name,
		open: false,
		since: now(),
		relations: [],
		members: {},
		invites: [],
		requests: [],
		home: null,
		power: 0
	};

	joinFamily(player, family, "agent", "Founder");
	player.sendMessage(
		info(`Successfully founded the Familia: §e${full} §7[${abbreviation}]`)
	);
}
