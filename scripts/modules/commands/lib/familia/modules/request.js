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
 * @typedef {Object} FamiliaRequestContext
 * @property {Player} player
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
 * @param {string} uid
 * @returns {FamiliaDataStore | null}
 */
function findFamilyByUid(uid) {
	return (
		/** @type {FamiliaDataStore | undefined} */ (
			database.get(uid, FAMILY_DB_KEY)
		) ?? null
	);
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
	database.set("index", [...index], FAMILY_DB_KEY, true);
}

/**
 * @param {FamiliaDataStore} family
 * @param {Player} player
 * @returns {boolean}
 */
function hasRequest(family, player) {
	return Boolean(
		(family.requests ?? []).find(name => lower(name) === lower(player.name))
	);
}

/**
 * @param {FamiliaDataStore} family
 * @param {Player} player
 * @returns {boolean}
 */
function hasInvite(family, player) {
	return Boolean(
		(family.invites ?? []).find(name => lower(name) === lower(player.name))
	);
}

/**
 * @param {Player} player
 * @returns {FamiliaDataStore | null}
 */
function getPlayerFamily(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) return null;
	return findFamilyByUid(state.data.uid);
}

/**
 * @param {Player} player
 * @param {FamiliaDataStore} family
 * @returns {boolean}
 */
function canManage(player, family) {
	const rank = family.members?.[player.name]?.rank ?? null;
	const score =
		rank === "member"
			? 1
			: rank === "officer"
				? 2
				: rank === "co-leader"
					? 3
					: rank === "agent"
						? 4
						: 0;
	return score >= 2;
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
 * Lists pending join requests for the player's Familia.
 * @param {Player} player
 * @returns {void}
 */
export function listRequests(player) {
	const family = getPlayerFamily(player);

	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family)) {
		failNow(player, "You do not have permission to view requests.");
		return;
	}

	const requests = family.requests ?? [];
	if (requests.length === 0) {
		player.sendMessage(info("There are no pending join requests."));
		return;
	}

	player.sendMessage(
		[
			"§6§lPending Requests§r",
			...requests.map(name => `§e- §f${name}`)
		].join("\n")
	);
}

/**
 * Accepts a join request from a player.
 * @param {Player} player
 * @param {FamiliaRequestContext} context
 * @returns {void}
 */
export function acceptRequest(player, context) {
	const family = getPlayerFamily(player);

	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family)) {
		failNow(player, "You do not have permission to accept requests.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (!hasRequest(family, context.player)) {
		failNow(player, "That player did not request to join.");
		return;
	}

	if (family.members?.[context.player.name]) {
		failNow(player, "That player is already in your Familia.");
		return;
	}

	joinFamily(context.player, family, "member", "");
	player.sendMessage(
		info(`Accepted §e${context.player.name}§a into the Familia.`)
	);
	context.player.sendMessage(info(`You joined §e${family.name.fullName}§a.`));
}

/**
 * Denies a join request from a player.
 * @param {Player} player
 * @param {FamiliaRequestContext} context
 * @returns {void}
 */
export function denyRequest(player, context) {
	const family = getPlayerFamily(player);

	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family)) {
		failNow(player, "You do not have permission to deny requests.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (!hasRequest(family, context.player)) {
		failNow(player, "That player did not request to join.");
		return;
	}

	family.requests = (family.requests ?? []).filter(
		name => lower(name) !== lower(context.player.name)
	);
	saveFamily(family);

	player.sendMessage(
		warn(`Denied §e${context.player.name}§e's join request.`)
	);
	context.player.sendMessage(
		fail(`Your request to join §e${family.name.fullName}§c was denied.`)
	);
}
