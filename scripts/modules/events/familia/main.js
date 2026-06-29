import { Player, world } from "@minecraft/server";
import database from "../../../core/database.js";

/**
 * @typedef {"ally" | "enemy" | "neutral"} FamiliaRelationType
 */

/**
 * @typedef {Object} FamiliaRelationEntry
 * @property {string} uid
 * @property {FamiliaRelationType} type
 * @property {number} [since]
 */

/**
 * @typedef {Object} FamiliaNameData
 * @property {string} abbreviation
 * @property {string} fullName
 */

/**
 * @typedef {Object} FamiliaRecord
 * @property {string} uid
 * @property {FamiliaNameData} [name]
 * @property {FamiliaRelationEntry[]} [relations]
 * @property {{ relations?: FamiliaRelationEntry[] }} [data]
 */

/**
 * @typedef {Object} FamiliaPlayerState
 * @property {boolean} haveFamilia
 * @property {{ uid?: string } | null} data
 */

/**
 * @param {string} playerName
 * @returns {FamiliaPlayerState | null}
 */
function getPlayerFamiliaState(playerName) {
	const state = /** @type {any} */ (database.get("familia", playerName));

	if (!state || state.haveFamilia !== true) {
		return null;
	}

	return state;
}

/**
 * @param {string} playerName
 * @returns {string}
 */
function getPlayerFamiliaUid(playerName) {
	const state = getPlayerFamiliaState(playerName);
	if (!state?.data?.uid) return "";
	return String(state.data.uid).trim();
}

/**
 * @param {string} uid
 * @returns {FamiliaRecord | null}
 */
function getFamiliaRecord(uid) {
	if (!uid) return null;
	return /** @type {FamiliaRecord | null} */ (
		database.get(uid, "familia") ?? null
	);
}

/**
 * @param {FamiliaRecord | null} family
 * @returns {FamiliaRelationEntry[]}
 */
function getFamiliaRelations(family) {
	if (!family) return [];

	if (Array.isArray(family.relations)) {
		return family.relations;
	}

	if (Array.isArray(family.data?.relations)) {
		return family.data.relations;
	}

	return [];
}

/**
 * @param {FamiliaRecord | null} family
 * @param {string} targetUid
 * @returns {FamiliaRelationEntry | null}
 */
function getRelationToTarget(family, targetUid) {
	if (!family || !targetUid) return null;

	const relations = getFamiliaRelations(family);
	const relation = relations.find(
		/**
		 * @param {FamiliaRelationEntry} entry
		 */
		entry => String(entry.uid) === String(targetUid)
	);

	return relation ?? null;
}

/**
 * @param {string} attackerUid
 * @param {string} victimUid
 * @returns {"same" | FamiliaRelationType}
 */
function resolveFamiliaRelation(attackerUid, victimUid) {
	if (!attackerUid || !victimUid) {
		return "neutral";
	}

	if (attackerUid === victimUid) {
		return "same";
	}

	const attackerFamily = getFamiliaRecord(attackerUid);
	const victimFamily = getFamiliaRecord(victimUid);

	const attackerRelation = getRelationToTarget(attackerFamily, victimUid);
	const victimRelation = getRelationToTarget(victimFamily, attackerUid);

	if (
		attackerRelation?.type === "enemy" ||
		victimRelation?.type === "enemy"
	) {
		return "enemy";
	}

	if (attackerRelation?.type === "ally" || victimRelation?.type === "ally") {
		return "ally";
	}

	return "neutral";
}

world.beforeEvents.entityHurt.subscribe(event => {
	const { hurtEntity, damageSource } = event;
	const damagingEntity = damageSource?.damagingEntity;

	if (
		!(hurtEntity instanceof Player) ||
		!(damagingEntity instanceof Player)
	) {
		return;
	}

	const attacker = damagingEntity;
	const victim = hurtEntity;

	const attackerUid = getPlayerFamiliaUid(attacker.name);
	const victimUid = getPlayerFamiliaUid(victim.name);

	if (!attackerUid || !victimUid) {
		return;
	}

	const relation = resolveFamiliaRelation(attackerUid, victimUid);

	if (relation === "same" || relation === "ally") {
		event.cancel = true;
		attacker.sendMessage(
			"§l§6> §r§cYou cannot attack §7your own familia or allies§c."
		);
		attacker.playSound("note.bass");
	}
});
