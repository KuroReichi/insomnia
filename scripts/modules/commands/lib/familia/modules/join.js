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
 * @typedef {Object} FamiliaJoinContext
 * @property {string} faction
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
 * @param {Player} player
 * @returns {void}
 */
function clearPlayerState(player) {
	database.set("familia", { haveFamilia: false, data: null }, player.name, true);
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
		since: Date.now()
	};

	family.members[player.name] = member;
	family.requests = (family.requests ?? []).filter(name => lower(name) !== lower(player.name));
	family.invites = (family.invites ?? []).filter(name => lower(name) !== lower(player.name));
	saveFamily(family);
	setPlayerState(player, { haveFamilia: true, data: member });
	return member;
}

/**
 * Requests to join an existing Familia.
 * If the Familia is open or the player has been invited, the player joins immediately.
 * Otherwise the player is added to the join request list.
 *
 * @param {Player} player
 * @param {FamiliaJoinContext} context
 * @returns {void}
 */
export function joinFamilia(player, context) {
	const target = clean(context.faction);
	if (!target) {
		failNow(player, "Invalid or missing arguments. Type §e/familia help§c for proper command usage.");
		return;
	}

	if (getPlayerState(player).haveFamilia) {
		failNow(player, "You already belong to a Familia.");
		return;
	}

	const family = findFamilia(target);
	if (!family) {
		failNow(player, "Familia not found.");
		return;
	}

	if (familyMemberCount(family, player.name)) {
		failNow(player, "You are already in this Familia.");
		return;
	}

	const invited = (family.invites ?? []).some(name => lower(name) === lower(player.name));
	if (family.open || invited) {
		joinFamily(player, family, "member", "");
		player.sendMessage(info(invited ? `You accepted the invitation and joined §e${family.name.fullName}§a.` : `You joined §e${family.name.fullName}§a.`));
		return;
	}

	family.requests ??= [];
	if (!family.requests.some(name => lower(name) === lower(player.name))) {
		family.requests.push(player.name);
		saveFamily(family);
	}

	player.sendMessage(warn(`Request sent to join §a${family.name.fullName}§e. Waiting for approval...`));
}

/**
 * @param {FamiliaDataStore} family
 * @param {string} playerName
 * @returns {boolean}
 */
function familyMemberCount(family, playerName) {
	return Boolean(Object.keys(family.members ?? {}).find(name => lower(name) === lower(playerName)));
}
