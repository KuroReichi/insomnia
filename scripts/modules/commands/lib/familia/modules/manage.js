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
 * @typedef {Object} FamiliaInviteContext
 * @property {Player} player
 */

/**
 * @typedef {Object} FamiliaKickContext
 * @property {Player} player
 */

/**
 * @typedef {Object} FamiliaSetRankContext
 * @property {Player} player
 * @property {"member" | "officer" | "co-leader" | "agent"} rank
 */

/**
 * @typedef {Object} FamiliaTitleContext
 * @property {Player} player
 * @property {string} title
 */

/**
 * @typedef {Object} FamiliaSetNameContext
 * @property {string} name
 */

/**
 * @typedef {Object} FamiliaMotdContext
 * @property {string} motd
 */

/**
 * @typedef {Object} FamiliaDescriptionContext
 * @property {string} text
 */

/**
 * @typedef {Object} FamiliaDisbandContext
 * @property {"confirm" | "cancel"} confirm
 */

const FAMILY_DB_KEY = "familia";
const RANK_SCORE = /** @type {const} */ ({
	member: 1,
	officer: 2,
	"co-leader": 3,
	agent: 4
});

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
 * @returns {FamiliaDataStore | null}
 */
function getPlayerFamily(player) {
	const state = getPlayerState(player);
	if (!state.haveFamilia || !state.data?.uid) return null;
	return findFamilyByUid(state.data.uid);
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
 * @param {Player} player
 * @param {FamiliaDataStore} family
 * @param {"member" | "officer" | "co-leader" | "agent"} minRank
 * @returns {boolean}
 */
function canManage(player, family, minRank = "officer") {
	const rank = family.members?.[player.name]?.rank ?? null;
	const score = RANK_SCORE[/** @type {keyof typeof RANK_SCORE} */ (rank)] ?? 0;
	return score >= RANK_SCORE[minRank];
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
 * @param {string} playerName
 * @returns {FamiliaData | null}
 */
function getMember(family, playerName) {
	const key = Object.keys(family.members ?? {}).find(name => lower(name) === lower(playerName));
	return key ? (family.members[key] ?? null) : null;
}

/**
 * @param {FamiliaDataStore} family
 * @param {string} playerName
 * @returns {string | null}
 */
function getMemberKey(family, playerName) {
	return Object.keys(family.members ?? {}).find(name => lower(name) === lower(playerName)) ?? null;
}

/**
 * @param {FamiliaDataStore} family
 * @param {Player} player
 * @returns {void}
 */
function clearPlayerStateFromFamily(family, player) {
	delete family.members[player.name];
	database.set("familia", { haveFamilia: false, data: null }, player.name, true);
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
	database.set("familia", { haveFamilia: true, data: member }, player.name, true);
	return member;
}

/**
 * @param {Player} player
 * @param {FamiliaDataStore} family
 * @param {Player} target
 * @returns {boolean}
 */
function canTargetBeManaged(player, family, target) {
	if (!hasMember(family, target.name)) return false;

	const actor = RANK_SCORE[/** @type {keyof typeof RANK_SCORE} */ (family.members?.[player.name]?.rank ?? "member")] ?? 0;
	const targetRank = RANK_SCORE[/** @type {keyof typeof RANK_SCORE} */ (family.members?.[target.name]?.rank ?? "member")] ?? 0;

	return actor > targetRank || target.name === player.name || family.members?.[player.name]?.rank === "agent";
}

/**
 * Invites a player to the Familia.
 * @param {Player} player
 * @param {FamiliaInviteContext} context
 * @returns {void}
 */
export function inviteFamilia(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "officer")) {
		failNow(player, "You do not have permission to invite members.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (hasMember(family, context.player.name)) {
		failNow(player, "That player is already in your Familia.");
		return;
	}

	family.invites ??= [];
	if (!family.invites.some(name => lower(name) === lower(context.player.name))) {
		family.invites.push(context.player.name);
		saveFamily(family);
	}

	player.sendMessage(info(`Successfully invited §e${context.player.name}§a to the Familia.`));
	context.player.sendMessage(warn(`You have been invited to join §a${player.name}'s§e Familia.`));
}

/**
 * Kicks a player from the Familia.
 * @param {Player} player
 * @param {FamiliaKickContext} context
 * @returns {void}
 */
export function kickFamilia(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "officer")) {
		failNow(player, "You do not have permission to kick members.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (!hasMember(family, context.player.name)) {
		failNow(player, "That player is not in your Familia.");
		return;
	}

	if (!canTargetBeManaged(player, family, context.player)) {
		failNow(player, "You cannot kick a member with equal or higher rank.");
		return;
	}

	clearPlayerStateFromFamily(family, context.player);
	saveFamily(family);

	player.sendMessage(warn(`${context.player.name} has been kicked from the Familia.`));
	context.player.sendMessage(fail(`You have been kicked from ${player.name}'s Familia.`));
}

/**
 * Sets a specific rank for a Familia member.
 * @param {Player} player
 * @param {FamiliaSetRankContext} context
 * @returns {void}
 */
export function setFamiliaRank(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to set ranks.");
		return;
	}

	if (!context.player || !context.rank) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const key = getMemberKey(family, context.player.name);
	if (!key) {
		failNow(player, "That player is not in your Familia.");
		return;
	}

	const actorScore = RANK_SCORE[/** @type {keyof typeof RANK_SCORE} */ (family.members[player.name]?.rank ?? "member")] ?? 0;
	const rankScore = RANK_SCORE[context.rank];

	if (rankScore > actorScore && family.members[player.name]?.rank !== "agent") {
		failNow(player, "You cannot assign a rank higher than yours.");
		return;
	}

	family.members[key].rank = context.rank;
	saveFamily(family);
	player.sendMessage(info(`Updated §e${context.player.name}'s§a rank to §e${context.rank}§a.`));
}

/**
 * Promotes a member to the next rank tier.
 * @param {Player} player
 * @param {FamiliaKickContext} context
 * @returns {void}
 */
export function promoteFamilia(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to promote members.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const key = getMemberKey(family, context.player.name);
	if (!key) {
		failNow(player, "That player is not in your Familia.");
		return;
	}

	const order = /** @type {const} */ (["member", "officer", "co-leader", "agent"]);
	const currentRank = /** @type {"member" | "officer" | "co-leader" | "agent"} */ (family.members[key].rank ?? "member");
	const index = order.indexOf(currentRank);

	if (index >= order.length - 1) {
		failNow(player, "That player already has the highest rank.");
		return;
	}

	family.members[key].rank = order[index + 1];
	saveFamily(family);
	player.sendMessage(info(`Successfully promoted §e${context.player.name}§a.`));
}

/**
 * Demotes a member to the previous rank tier.
 * @param {Player} player
 * @param {FamiliaKickContext} context
 * @returns {void}
 */
export function demoteFamilia(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to demote members.");
		return;
	}

	if (!context.player) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const key = getMemberKey(family, context.player.name);
	if (!key) {
		failNow(player, "That player is not in your Familia.");
		return;
	}

	const order = /** @type {const} */ (["member", "officer", "co-leader", "agent"]);
	const currentRank = /** @type {"member" | "officer" | "co-leader" | "agent"} */ (family.members[key].rank ?? "member");
	const index = order.indexOf(currentRank);

	if (index <= 0) {
		failNow(player, "That player already has the lowest rank.");
		return;
	}

	family.members[key].rank = order[index - 1];
	saveFamily(family);
	player.sendMessage(fail(`Demoted §e${context.player.name}§c.`));
}

/**
 * Assigns a custom cosmetic title to a member.
 * @param {Player} player
 * @param {FamiliaTitleContext} context
 * @returns {void}
 */
export function setFamiliaTitle(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "officer")) {
		failNow(player, "You do not have permission to set titles.");
		return;
	}

	if (!context.player || !context.title) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const key = getMemberKey(family, context.player.name);
	if (!key) {
		failNow(player, "That player is not in your Familia.");
		return;
	}

	family.members[key].title = clean(context.title).slice(0, 64);
	saveFamily(family);
	player.sendMessage(info(`Assigned the title '§r${family.members[key].title}§a' to §e${context.player.name}§a.`));
}

/**
 * Updates the Familia's 5-character abbreviation.
 * @param {Player} player
 * @param {FamiliaSetNameContext} context
 * @returns {void}
 */
export function setFamiliaAbbreviation(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to rename the Familia.");
		return;
	}

	const name = clean(context.name).toUpperCase();
	if (!name) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (name.length > 5) {
		failNow(player, "Abbreviation must be at most 5 characters.");
		return;
	}

	const clash = findFamilia(name);
	if (clash && clash.uid !== family.uid) {
		failNow(player, "Another Familia already uses that abbreviation.");
		return;
	}

	family.name.abbreviation = name;
	saveFamily(family);
	player.sendMessage(info(`Familia abbreviation has been updated to: §e${name}`));
}

/**
 * Updates the Familia's full name.
 * @param {Player} player
 * @param {FamiliaSetNameContext} context
 * @returns {void}
 */
export function setFamiliaFullname(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "co-leader")) {
		failNow(player, "You do not have permission to rename the Familia.");
		return;
	}

	const name = clean(context.name);
	if (!name) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	if (name.length > 28) {
		failNow(player, "Full name must be at most 28 characters.");
		return;
	}

	const clash = findFamilia(name);
	if (clash && clash.uid !== family.uid) {
		failNow(player, "Another Familia already uses that full name.");
		return;
	}

	family.name.fullName = name;
	saveFamily(family);
	player.sendMessage(info(`Familia name has been updated to: §e${name}`));
}

/**
 * Updates the Message of the Day (MOTD).
 * @param {Player} player
 * @param {FamiliaMotdContext} context
 * @returns {void}
 */
export function setFamiliaMotd(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "officer")) {
		failNow(player, "You do not have permission to set the MOTD.");
		return;
	}

	const motd = clean(context.motd);
	if (!motd) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	family.motd = motd.slice(0, 256);
	saveFamily(family);
	player.sendMessage(info(`Familia MOTD updated to:\n§r${family.motd}`));
}

/**
 * Updates the Familia description.
 * @param {Player} player
 * @param {FamiliaDescriptionContext} context
 * @returns {void}
 */
export function setFamiliaDescription(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "officer")) {
		failNow(player, "You do not have permission to edit the description.");
		return;
	}

	const text = clean(context.text);
	if (!text) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	family.description = text.slice(0, 256);
	saveFamily(family);
	player.sendMessage(info("Familia description updated."));
}

/**
 * Handles Familia disbandment procedures.
 * @param {Player} player
 * @param {FamiliaDisbandContext} context
 * @returns {void}
 */
export function disbandFamilia(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family, "agent")) {
		failNow(player, "Only the Familia leader can disband the Familia.");
		return;
	}

	if (context.confirm === "cancel") {
		player.sendMessage(info("Disbandment process cancelled."));
		return;
	}

	if (context.confirm !== "confirm") {
		player.sendMessage(warn("Are you sure you want to disband the Familia? Type §c/familia disband confirm§e to proceed."));
		return;
	}

	for (const name of Object.keys(family.members ?? {})) {
		database.set("familia", { haveFamilia: false, data: null }, name, true);
	}

	deleteFamily(family.uid);
	player.sendMessage(fail("The Familia has been officially disbanded."));
}
