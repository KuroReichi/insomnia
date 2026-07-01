import {
	Entity,
	Player,
	world,
	ItemStack,
	EquipmentSlot
} from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";
import { getDate } from "../../utility/date.js";

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
const COMBAT_EXPIRE_MS = 30_000;

/** Bounty / death balance */
const bountyRate = 0.18;
const deathPenaltyRate = 0.06;
const bountyCooldown = 30 * 60 * 1000;

/** Soft caps so very rich players do not get hit too hard */
const MAX_BOUNTY_POOL = 40_000;
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

	return Math.max(1, entry.totalDamage) * (0.45 + 0.55 * recency);
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatSourceLabel(value) {
	const raw = String(value ?? "")
		.replace(/^minecraft:/, "")
		.replace(/[_:]/g, " ")
		.trim();

	if (!raw) return "Unknown";

	return raw.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * @param {any} damageSource
 * @returns {{ killerName: string; killerKind: "entity" | "cause" | "unknown" }}
 */
function getDamageSourceTruth(damageSource) {
	const entity = damageSource?.damagingEntity ?? null;
	const cause = String(damageSource?.cause ?? "");

	if (entity) {
		return {
			killerName: formatSourceLabel(
				safeString(entity.nameTag) ||
					safeString(entity.name) ||
					String(entity.typeId ?? "")
			),
			killerKind: "entity"
		};
	}

	switch (cause) {
		case "explosion":
		case "blockExplosion":
			return { killerName: "Explosion", killerKind: "cause" };
		case "fall":
			return { killerName: "Fall", killerKind: "cause" };
		case "drown":
		case "drowning":
			return { killerName: "Drowning", killerKind: "cause" };
		case "lava":
			return { killerName: "Lava", killerKind: "cause" };
		case "fire":
		case "onFire":
			return { killerName: "Fire", killerKind: "cause" };
		case "lightningBolt":
			return { killerName: "Lightning", killerKind: "cause" };
		case "freeze":
			return { killerName: "Freezing", killerKind: "cause" };
		case "outOfWorld":
			return { killerName: "Void", killerKind: "cause" };
		case "starve":
			return { killerName: "Starvation", killerKind: "cause" };
		case "wither":
			return { killerName: "Wither", killerKind: "cause" };
		default:
			return { killerName: "Unknown", killerKind: "unknown" };
	}
}

/**
 * @param {string} victimName
 * @param {any} damageSource
 * @returns {{ killerName: string; killerKind: "player" | "entity" | "cause" | "unknown"; track: CombatTrack }}
 */
function resolveCombatSource(victimName, damageSource) {
	const track = getCombatTrack(victimName);
	const now = Date.now();

	track.withPlayers = pruneCombatList(track.withPlayers);
	saveCombatTrack(victimName, track);

	if (track.withPlayers.length > 0) {
		const lastHitName = track.lastHit?.player ?? "";
		const lastHitAlive =
			!!lastHitName &&
			track.withPlayers.some(p => p.name === lastHitName);

		if (lastHitAlive) {
			return {
				killerName: lastHitName,
				killerKind: "player",
				track
			};
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
			killerName: best?.name ?? "Unknown player",
			killerKind: "player",
			track
		};
	}

	const truth = getDamageSourceTruth(damageSource);

	return {
		killerName: truth.killerName,
		killerKind: truth.killerKind,
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

/**
 * @param {any} damageSource
 * @param {boolean} killerIsPlayer
 * @param {boolean} hasItem
 * @returns {string}
 */
function getDeathTranslateKey(damageSource, killerIsPlayer, hasItem) {
	const cause = String(damageSource?.cause ?? "generic");

	switch (cause) {
		case "anvil":
			return "death.attack.anvil";
		case "arrow":
			return killerIsPlayer && hasItem
				? "death.attack.arrow.item"
				: "death.attack.arrow";
		case "blockExplosion":
		case "explosion":
			return killerIsPlayer
				? "death.attack.explosion.player"
				: "death.attack.explosion";
		case "cactus":
			return killerIsPlayer
				? "death.attack.cactus.player"
				: "death.attack.cactus";
		case "dehydration":
			return "death.attack.dehydration";
		case "drown":
			return killerIsPlayer
				? "death.attack.drown.player"
				: "death.attack.drown";
		case "fall":
			return "death.fell.accident.generic";
		case "fallingBlock":
			return "death.attack.fallingBlock";
		case "fire":
			return killerIsPlayer
				? "death.attack.inFire.player"
				: "death.attack.inFire";
		case "fireball":
			return killerIsPlayer && hasItem
				? "death.attack.fireball.item"
				: "death.attack.fireball";
		case "fireworks":
			return "death.attack.fireworks";
		case "flyIntoWall":
			return "death.attack.flyIntoWall";
		case "freeze":
			return "death.attack.freeze";
		case "generic":
			return "death.attack.generic";
		case "indirectMagic":
			return killerIsPlayer && hasItem
				? "death.attack.indirectMagic.item"
				: "death.attack.indirectMagic";
		case "inWall":
			return "death.attack.inWall";
		case "lava":
			return killerIsPlayer
				? "death.attack.lava.player"
				: "death.attack.lava";
		case "lightningBolt":
			return "death.attack.lightningBolt";
		case "maceSmash":
			return killerIsPlayer && hasItem
				? "death.attack.maceSmash.player.item"
				: killerIsPlayer
					? "death.attack.maceSmash.player"
					: "death.attack.maceSmash";
		case "magic":
			return killerIsPlayer
				? "death.attack.indirectMagic"
				: "death.attack.magic";
		case "magma":
			return killerIsPlayer
				? "death.attack.magma.player"
				: "death.attack.magma";
		case "mob":
			return killerIsPlayer && hasItem
				? "death.attack.mob.item"
				: killerIsPlayer
					? "death.attack.player"
					: "death.attack.mob";
		case "onFire":
			return killerIsPlayer
				? "death.attack.onFire.player"
				: "death.attack.onFire";
		case "outOfWorld":
			return "death.attack.outOfWorld";
		case "projectile":
			return killerIsPlayer && hasItem
				? "death.attack.arrow.item"
				: "death.attack.arrow";
		case "spit":
			return "death.attack.spit";
		case "sonicBoom":
			return killerIsPlayer
				? "death.attack.sonicBoom.player"
				: "death.attack.sonicBoom";
		case "starve":
			return "death.attack.starve";
		case "sweetBerry":
			return "death.attack.sweetBerry";
		case "thorns":
			return "death.attack.thorns";
		case "thrown":
			return killerIsPlayer && hasItem
				? "death.attack.thrown.item"
				: "death.attack.thrown";
		case "trident":
			return killerIsPlayer && hasItem
				? "death.attack.trident.item"
				: "death.attack.trident";
		case "wither":
			return "death.attack.wither";
		case "stalactite":
			return "death.attack.stalactite";
		case "stalagmite":
			return "death.attack.stalagmite";
		case "drowning":
			return "death.attack.drown";
		default:
			return killerIsPlayer
				? "death.attack.player"
				: "death.attack.generic";
	}
}

/**
 * @param {string} key
 * @param {string} victimName
 * @param {string} killerName
 * @param {string} itemName
 * @param {boolean} hasItem
 * @returns {import("@minecraft/server").RawMessage}
 */
function buildDeathTranslateMessage(
	key,
	victimName,
	killerName,
	itemName,
	hasItem
) {
	const victimText = `§c${victimName}`;
	const killerText = `§e${killerName}`;
	const itemText = `§b${itemName}`;

	switch (key) {
		case "death.attack.arrow.item":
		case "death.attack.fireball.item":
		case "death.attack.indirectMagic.item":
		case "death.attack.maceSmash.player.item":
		case "death.attack.mob.item":
		case "death.attack.thrown.item":
		case "death.attack.trident.item":
			return {
				translate: key,
				with: [victimText, killerText, hasItem ? itemText : killerText]
			};

		case "death.attack.arrow":
		case "death.attack.cactus.player":
		case "death.attack.drown.player":
		case "death.attack.explosion.player":
		case "death.attack.inFire.player":
		case "death.attack.lava.player":
		case "death.attack.maceSmash.player":
		case "death.attack.onFire.player":
		case "death.attack.sonicBoom.player":
		case "death.attack.thrown":
		case "death.attack.trident":
		case "death.attack.player":
		case "death.attack.mob":
		case "death.attack.indirectMagic":
		case "death.attack.magic":
		case "death.attack.magma.player":
		case "death.attack.fireball":
			return {
				translate: key,
				with: [victimText, killerText]
			};

		case "death.attack.anvil":
		case "death.attack.cactus":
		case "death.attack.dehydration":
		case "death.attack.drown":
		case "death.attack.explosion":
		case "death.attack.fallingBlock":
		case "death.attack.flyIntoWall":
		case "death.attack.freeze":
		case "death.attack.generic":
		case "death.attack.inFire":
		case "death.attack.inWall":
		case "death.attack.lava":
		case "death.attack.lightningBolt":
		case "death.attack.maceSmash":
		case "death.attack.magma":
		case "death.attack.onFire":
		case "death.attack.outOfWorld":
		case "death.attack.spit":
		case "death.attack.starve":
		case "death.attack.sweetBerry":
		case "death.attack.thorns":
		case "death.attack.wither":
		case "death.attack.sonicBoom":
		case "death.attack.stalactite":
		case "death.attack.stalagmite":
		case "death.fell.accident.generic":
			return {
				translate: key,
				with: [victimText]
			};

		default:
			return {
				text: `§c${victimName} §7died`
			};
	}
}

/**
 * @param {string} victimName
 * @param {{ killerName: string; killerKind: "entity" | "cause" | "unknown" }} truth
 * @param {any} damageSource
 * @returns {import("@minecraft/server").RawMessage}
 */
function buildNonPlayerDeathMessage(victimName, truth, damageSource) {
	const cause = String(damageSource?.cause ?? "");
	const killerName = truth.killerName;

	switch (cause) {
		case "blockExplosion":
		case "explosion":
			return {
				text:
					truth.killerKind === "entity" && killerName !== "Explosion"
						? `§c${victimName} §7was blown up by §e${killerName}§8.`
						: `§c${victimName} §7was blown up§8.`
			};

		case "fall":
			return {
				text: `§c${victimName} §7fell from a high place§8.`
			};

		case "drown":
		case "drowning":
			return {
				text: `§c${victimName} §7drowned§8.`
			};

		case "lava":
			return {
				text: `§c${victimName} §7tried to swim in lava§8.`
			};

		case "fire":
		case "onFire":
			return {
				text: `§c${victimName} §7went up in flames§8.`
			};

		case "lightningBolt":
			return {
				text: `§c${victimName} §7was struck by lightning§8.`
			};

		case "freeze":
			return {
				text: `§c${victimName} §7froze to death§8.`
			};

		case "outOfWorld":
			return {
				text: `§c${victimName} §7fell out of the world§8.`
			};

		case "starve":
			return {
				text: `§c${victimName} §7starved to death§8.`
			};

		case "wither":
			return {
				text: `§c${victimName} §7withered away§8.`
			};

		default:
			if (truth.killerKind === "entity") {
				return {
					text: `§c${victimName} §7was slain by §e${killerName}§8.`
				};
			}

			if (truth.killerKind === "cause" && killerName !== "Unknown") {
				return {
					text: `§c${victimName} §7died to §e${killerName}§8.`
				};
			}

			return {
				text: `§c${victimName} §7died§8.`
			};
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
	const damageSource = event.damageSource ?? {};
	const {
		killerName,
		killerKind,
		track: combatTrack
	} = resolveCombatSource(player.name, damageSource);

	const sameKillerRecently =
		killerKind === "player" &&
		!!lastDeath &&
		lastDeath.killerName === killerName &&
		now - lastDeath.date < bountyCooldown;

	const bountyPool =
		killerKind === "player" && !sameKillerRecently
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
		killerKind === "player"
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

	const hasItem =
		killerKind === "player" && !!combatTrack.lastHit?.using?.nameTag;
	const itemName =
		safeString(combatTrack.lastHit?.using?.nameTag) ||
		safeString(combatTrack.lastHit?.using?.typeId) ||
		"item";

	let deathMessage;

	if (killerKind === "player") {
		const deathKey = getDeathTranslateKey(damageSource, true, hasItem);

		deathMessage = buildDeathTranslateMessage(
			deathKey,
			player.name,
			killerName,
			itemName,
			hasItem
		);
	} else {
		deathMessage = buildNonPlayerDeathMessage(
			player.name,
			{ killerName, killerKind },
			damageSource
		);
	}

	const rewardLine = ` §8[§eBounty §7-${currency}${bountyPool}§8, §cDeath §7-${currency}${deathPenalty}§8]`;

	world.sendMessage({
		rawtext: [
			{ text: "§c" },
			deathMessage,
			{
				text:
					killerKind === "player"
						? ` §7(§c:heart:${killerHealth}§7)§8.`
						: "§8."
			},
			{ text: rewardLine }
		]
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
		`§r§6Obtained at §e${getDate()}§f`,
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
		item.amount -= 1;
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
