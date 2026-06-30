import {
	Entity,
	Player,
	world,
	ItemStack,
	EquipmentSlot
} from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";

/**
 * @typedef {{killerName:string,date:number}} DeathEntry
 * @typedef {{isDeathRecently:boolean,data:DeathEntry,lastDeaths:DeathEntry[]}} DeathTrack
 *
 * @typedef {{
 *   name: string;
 *   totalDamage: number;
 *   expiredAt: number;
 * }} CombatContributor
 *
 * @typedef {{
 *   player: string;
 *   using: {
 *     typeId: string;
 *     nameTag: string;
 *   };
 * }} CombatLastHit
 *
 * @typedef {{
 *   withPlayers: CombatContributor[];
 *   lastHit: CombatLastHit | null;
 * }} CombatTrack
 */

const currency = configs.modules.economy.currency;

/** Combat window in milliseconds */
const COMBAT_EXPIRE_MS = 60_000;

/** Bounty / death balance */
const bountyRate = 0.18;
const deathPenaltyRate = 0.06;
const bountyCooldown = 30 * 60 * 1000;

/** Soft caps so very rich players do not get hit too hard */
const MAX_BOUNTY_POOL = 20_000;
const MAX_DEATH_PENALTY = 8_000;

/** Last hit should matter a little more, but not dominate too hard */
const LAST_HIT_WEIGHT_BONUS = 1.25;

/**
 * @param {string} name
 * @returns {number}
 */
function getMoney(name) {
	return Number(database.get("money", name) ?? 0);
}

/**
 * @param {string} name
 * @param {number} amount
 */
function addBounty(name, amount) {
	if (amount > 0) database.add("bounty", name, amount);
}

/**
 * @param {string} name
 * @param {number} amount
 */
function removeMoney(name, amount) {
	if (amount > 0) database.remove("money", name, amount);
}

/**
 * @param {string} name
 * @returns {DeathTrack}
 */
function getDeathTrack(name) {
	return /** @type {DeathTrack} */ (
		database.get("death.tracks", name) ?? {
			isDeathRecently: false,
			data: { killerName: "", date: 0 },
			lastDeaths: []
		}
	);
}

/**
 * @param {string} name
 * @param {DeathTrack} track
 */
function saveDeathTrack(name, track) {
	database.set("death.tracks", track, name);
}

/**
 * @param {string} name
 * @returns {CombatTrack}
 */
function getCombatTrack(name) {
	return /** @type {CombatTrack} */ (
		database.get("combat", name) ?? {
			withPlayers: [],
			lastHit: null
		}
	);
}

/**
 * @param {string} name
 * @param {CombatTrack} track
 */
function saveCombatTrack(name, track) {
	database.set("combat", track, name);
}

/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
function safeString(value) {
	return typeof value === "string" && value.length > 0 ? value : "";
}

/**
 * @param {Player} player
 * @returns {{typeId: string, nameTag: string}}
 */
function snapshotMainHand(player) {
	/** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */
	const equippable = /** @type {any} */ (
		player.getComponent("minecraft:equippable")
	);

	/** @type {import("@minecraft/server").ItemStack | undefined} */
	const mainHand =
		equippable?.getEquipment(EquipmentSlot.Mainhand) ?? undefined;

	return {
		typeId: mainHand?.typeId ?? "minecraft:air",
		nameTag:
			safeString(mainHand?.nameTag) ||
			safeString(/** @type {any} */ (mainHand)?.localizationKey) ||
			mainHand?.typeId ||
			"minecraft:air"
	};
}

/**
 * @param {CombatContributor[]} list
 * @returns {CombatContributor[]}
 */
function pruneCombatList(list) {
	const now = Date.now();

	return list
		.filter(entry => entry.expiredAt > now)
		.sort(
			(a, b) => b.expiredAt - a.expiredAt || b.totalDamage - a.totalDamage
		);
}

/**
 * @param {Entity} victim
 * @param {Player} attacker
 * @param {number} damage
 */
function updateCombat(victim, attacker, damage) {
	if (damage <= 0) return;

	/** @type {Player} */
	const p = /** @type {Player} */ (victim);
	const victimName = p.name;

	const now = Date.now();
	const track = getCombatTrack(victimName);
	const item = snapshotMainHand(attacker);
	const index = track.withPlayers.findIndex(
		entry => entry.name === attacker.name
	);

	track.withPlayers = pruneCombatList(track.withPlayers);

	if (index >= 0) {
		track.withPlayers[index].totalDamage += damage;
		track.withPlayers[index].expiredAt = now + COMBAT_EXPIRE_MS;
	} else {
		track.withPlayers.push({
			name: attacker.name,
			totalDamage: damage,
			expiredAt: now + COMBAT_EXPIRE_MS
		});
	}

	track.withPlayers = pruneCombatList(track.withPlayers);

	track.lastHit = {
		player: attacker.name,
		using: item
	};

	saveCombatTrack(victimName, track);
}

/**
 * @param {CombatContributor} entry
 * @param {number} now
 * @returns {number}
 */
function getCombatWeight(entry, now) {
	const remaining = Math.max(0, entry.expiredAt - now);
	const recency = remaining / COMBAT_EXPIRE_MS;

	// Recent contributors get more weight, but totalDamage still matters most.
	return Math.max(1, entry.totalDamage) * (0.45 + 0.55 * recency);
}

/**
 * @param {string} victimName
 * @returns {{ killerName: string; track: CombatTrack }}
 */
function resolveCombatSource(victimName) {
	const track = getCombatTrack(victimName);
	const now = Date.now();

	track.withPlayers = pruneCombatList(track.withPlayers);
	saveCombatTrack(victimName, track);

	if (track.withPlayers.length === 0) {
		return { killerName: "Environment", track };
	}

	const lastHitName = track.lastHit?.player ?? "";
	const lastHitAlive =
		!!lastHitName && track.withPlayers.some(p => p.name === lastHitName);

	if (lastHitAlive) {
		return { killerName: lastHitName, track };
	}

	const best = track.withPlayers
		.map(entry => ({
			...entry,
			weight: getCombatWeight(entry, now)
		}))
		.sort(
			(a, b) => b.weight - a.weight || b.totalDamage - a.totalDamage
		)[0];

	return {
		killerName: best?.name ?? "Environment",
		track
	};
}

/**
 * @param {number} moneyBeforeDeath
 * @returns {number}
 */
function getBountyPool(moneyBeforeDeath) {
	const scaled = Math.floor(moneyBeforeDeath * bountyRate);
	const softCap = Math.floor(Math.sqrt(moneyBeforeDeath) * 250);

	return Math.max(0, Math.min(scaled, softCap, MAX_BOUNTY_POOL));
}

/**
 * @param {number} moneyBeforeDeath
 * @returns {number}
 */
function getDeathPenalty(moneyBeforeDeath) {
	const scaled = Math.floor(moneyBeforeDeath * deathPenaltyRate);
	const softCap = Math.floor(Math.sqrt(moneyBeforeDeath) * 120);

	return Math.max(0, Math.min(scaled, softCap, MAX_DEATH_PENALTY));
}

/**
 * @param {CombatContributor[]} contributors
 * @param {number} pool
 * @param {string} killerName
 */
function distributeBounty(contributors, pool, killerName) {
	if (pool <= 0 || contributors.length === 0) return;

	const now = Date.now();

	const weighted = contributors
		.map(entry => {
			let weight = getCombatWeight(entry, now);

			if (entry.name === killerName) {
				weight *= LAST_HIT_WEIGHT_BONUS;
			}

			return {
				name: entry.name,
				weight
			};
		})
		.sort((a, b) => b.weight - a.weight);

	const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
	if (totalWeight <= 0) return;

	let remaining = pool;

	for (let i = 0; i < weighted.length; i++) {
		const entry = weighted[i];

		let share;
		if (i === weighted.length - 1) {
			share = remaining;
		} else {
			share = Math.floor((pool * entry.weight) / totalWeight);
			remaining -= share;
		}

		if (share > 0) {
			addBounty(entry.name, share);
		}
	}
}

world.afterEvents.entityHurt.subscribe(
	event => {
		const victim = event.hurtEntity;
		const attackerEntity = event.damageSource?.damagingEntity ?? null;

		if (!victim || victim.typeId !== "minecraft:player") return;
		if (!attackerEntity || attackerEntity.typeId !== "minecraft:player")
			return;

		/** @type {Player} */
		const attacker = /** @type {Player} */ (attackerEntity);

		const damage = Math.max(1, Math.floor(Number(event.damage ?? 0)));
		updateCombat(victim, attacker, damage);
	},
	{
		entityTypes: ["minecraft:player"]
	}
);

world.afterEvents.entityDie.subscribe(event => {
	if (event.deadEntity.typeId !== "minecraft:player") return;

	/** @type {Player} */
	const player = /** @type {Player} */ (event.deadEntity);

	const now = Date.now();
	const moneyBeforeDeath = Math.max(0, Math.floor(getMoney(player.name)));

	const track = getDeathTrack(player.name);
	const lastDeath = track.lastDeaths[track.lastDeaths.length - 1];
	const { killerName, track: combatTrack } = resolveCombatSource(player.name);

	const sameKillerRecently =
		killerName !== "Environment" &&
		!!lastDeath &&
		lastDeath.killerName === killerName &&
		now - lastDeath.date < bountyCooldown;

	const bountyPool =
		killerName !== "Environment" && !sameKillerRecently
			? getBountyPool(moneyBeforeDeath)
			: 0;

	const deathPenalty = getDeathPenalty(moneyBeforeDeath);

	if (bountyPool > 0) {
		distributeBounty(combatTrack.withPlayers, bountyPool, killerName);
		removeMoney(player.name, bountyPool);
	}

	if (deathPenalty > 0) {
		removeMoney(player.name, deathPenalty);
	}

	track.isDeathRecently = true;
	track.data = {
		killerName,
		date: now
	};

	track.lastDeaths.push(track.data);
	if (track.lastDeaths.length > 20) track.lastDeaths.shift();

	saveDeathTrack(player.name, track);

	const killerPlayer =
		killerName !== "Environment"
			? (world.getAllPlayers().find(p => p.name === killerName) ?? null)
			: null;

	const killerHealth = killerPlayer
		? Math.floor(
				Number(
					/** @type {any} */ (
						killerPlayer.getComponent("minecraft:health")
					)?.currentValue ?? 0
				)
			)
		: 0;

	const deathLine =
		killerName !== "Environment"
			? `§7${player.name} §cwas slain by §e${killerName} §7(§c:heart:${killerHealth}§7)§8.`
			: `§7${player.name} §cdied§8.`;

	const rewardLine = ` §8[§eBounty §7-${currency}${bountyPool}§8, §cDeath §7-${currency}${deathPenalty}§8]`;

	world.sendMessage({
		rawtext: [{ text: deathLine }, { text: rewardLine }]
	});

	for (const listener of world.getAllPlayers()) {
		listener.playSound("ambient.weather.thunder");
	}

	// Clear combat state after death so the next fight starts fresh.
	saveCombatTrack(player.name, {
		withPlayers: [],
		lastHit: null
	});

	const heart = new ItemStack("miaw:heart", 1);
	heart.nameTag = `§r§u${player.name} §dHeart§u'§ds§r`;
	heart.setLore([
		`§r§6Obtained at §e${new Intl.DateTimeFormat("en-GB").format(new Date())}§f`,
		`§r§9× §3by §b${killerName}§f`
	]);

	player.dimension.spawnItem(heart, player.location);
});

world.afterEvents.itemUse.subscribe(event => {
	if (
		event.itemStack?.typeId !== "miaw:heart" ||
		event.source.typeId !== "minecraft:player"
	) {
		return;
	}

	/** @type {Player} */
	const player = /** @type {Player} */ (event.source);

	/** @type {import("@minecraft/server").EntityInventoryComponent} */
	const inventory = /** @type {any} */ (
		player.getComponent("minecraft:inventory")
	);

	/** @type {import("@minecraft/server").EntityHealthComponent} */
	const health = /** @type {any} */ (player.getComponent("minecraft:health"));

	/** @type {import("@minecraft/server").Container} */
	const container = inventory.container;

	const slot = /** @type {number} */ (player.selectedSlotIndex);

	const item = event.itemStack.clone();
	item.amount -= 1;

	if (Math.floor(Number(health.defaultValue)) >= 40) {
		player.sendMessage({
			text: "§l§6> §r§cYou reached max health limit!"
		});
		player.playSound("note.bass");
		return;
	}

	if (item.amount <= 1) {
		player.runCommand(
			`replaceitem entity @s slot.hotbar ${player.selectedSlotIndex} air`
		);
	} else {
		container.setItem(slot, item);
	}

	const nextHealth = Math.floor(Number(health.defaultValue) + 2);

	player.runCommand(`event entity "${player.name}" miaw:hp_${nextHealth}`);
	player.sendMessage({
		text: `§l§6> §r§cHealth §7increased to §e${nextHealth}`
	});

	player.runCommand(
		`execute as "${player.name}" at @s run playsound random.levelup @a ~~~`
	);
});
