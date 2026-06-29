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
 * @typedef {Object} FamiliaRelationContext
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
 * @param {string} playerName
 * @returns {boolean}
 */
function hasMember(family, playerName) {
	return Boolean(
		Object.keys(family.members ?? {}).find(
			name => lower(name) === lower(playerName)
		)
	);
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
	return score >= 3;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeRelationType(text) {
	return lower(text);
}

/**
 * @param {FamiliaDataStore} source
 * @param {FamiliaDataStore} target
 * @returns {FamiliaRelations | null}
 */
function getRelation(source, target) {
	return (
		(source.relations ?? []).find(
			relation => relation.uid === target.uid
		) ?? null
	);
}

/**
 * @param {FamiliaDataStore} source
 * @param {FamiliaDataStore} target
 * @param {"ally" | "enemy" | "neutral"} type
 * @returns {void}
 */
function setRelationOnFamily(source, target, type) {
	source.relations ??= [];

	const next = /** @type {FamiliaRelations} */ ({
		uid: target.uid,
		type,
		since: Date.now()
	});

	const index = source.relations.findIndex(
		relation => relation.uid === target.uid
	);
	if (index >= 0) {
		source.relations[index] = next;
	} else {
		source.relations.push(next);
	}
}

/**
 * Sets relation between the player's Familia and another Familia.
 * @param {Player} player
 * @param {FamiliaRelationContext} context
 * @param {"ally" | "enemy" | "neutral"} type
 * @returns {void}
 */
export function setRelation(player, context, type) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family)) {
		failNow(player, "You do not have permission to manage relations.");
		return;
	}

	const targetQuery = clean(context.faction);
	if (!targetQuery) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const target = findFamilia(targetQuery);
	if (!target) {
		failNow(player, "Target Familia not found.");
		return;
	}

	if (target.uid === family.uid) {
		failNow(player, "You cannot set relation with your own Familia.");
		return;
	}

	setRelationOnFamily(family, target, type);
	setRelationOnFamily(target, family, type);
	saveFamily(family);
	saveFamily(target);

	player.sendMessage(
		info(`Relation with §e${target.name.fullName}§a set to §e${type}§a.`)
	);
}

/**
 * Removes relation between the player's Familia and another Familia.
 * @param {Player} player
 * @param {FamiliaRelationContext} context
 * @returns {void}
 */
export function removeRelation(player, context) {
	const family = getPlayerFamily(player);
	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	if (!canManage(player, family)) {
		failNow(player, "You do not have permission to manage relations.");
		return;
	}

	const targetQuery = clean(context.faction);
	if (!targetQuery) {
		failNow(player, "Invalid or missing arguments.");
		return;
	}

	const target = findFamilia(targetQuery);
	if (!target) {
		failNow(player, "Target Familia not found.");
		return;
	}

	family.relations = (family.relations ?? []).filter(
		relation => relation.uid !== target.uid
	);
	target.relations = (target.relations ?? []).filter(
		relation => relation.uid !== family.uid
	);

	saveFamily(family);
	saveFamily(target);

	player.sendMessage(
		info(`Removed relation with §e${target.name.fullName}§a.`)
	);
}

/**
 * Lists all relations of the player's Familia.
 * @param {Player} player
 * @returns {void}
 */
export function listRelations(player) {
	const family = getPlayerFamily(player);

	if (!family) {
		failNow(player, "You are not in a Familia.");
		return;
	}

	const relations = family.relations ?? [];
	if (relations.length === 0) {
		player.sendMessage(info("This Familia has no relations yet."));
		return;
	}

	const lines = ["§6§lFamilia Relations§r"];

	for (const relation of relations) {
		const target = findFamilyByUid(relation.uid);
		const name = target?.name?.fullName ?? relation.uid;
		lines.push(`§e- §f${name} §7[${relation.type}]`);
	}

	player.sendMessage(lines.join("\n"));
}
