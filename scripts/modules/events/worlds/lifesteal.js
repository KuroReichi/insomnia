import { Player, world, ItemStack } from "@minecraft/server";
import { configs } from "../../../core/configs.js";
import database from "../../../core/database.js";

/**
 * @typedef {{killerName:string,date:number}} DeathEntry
 * @typedef {{isDeathRecently:boolean,data:DeathEntry,lastDeaths:DeathEntry[]}} DeathTrack
 */

const currency = configs.modules.economy.currency;
const bountyRate = 0.3;
const killerShare = 0.7;
const deathPenaltyRate = 0.2;
const bountyCooldown = 30 * 60 * 1000;

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
function getTrack(name) {
	return /** @type {DeathTrack} */ (
		database.get("death.tracks", name) ?? {
			isDeathRecently: false,
			data: { killerName: "", date: 0 },
			lastDeaths: []
		}
	);
}

/**
 * @param {number | Date | string} [value]
 * @returns {string}
 */
function formatDate(value = new Date()) {
	const date = new Date(value);

	/** @param {number} n */
	const pad = n => String(n).padStart(2, "0");

	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

world.afterEvents.entityDie.subscribe(event => {
	if (event.deadEntity.typeId !== "minecraft:player") return;

	/** @type {Player} */
	const player = /** @type {Player} */ (event.deadEntity);

	const damagingEntity = event.damageSource?.damagingEntity ?? null;
	const atk =
		damagingEntity?.typeId === "minecraft:player"
			? /** @type {Player} */ (damagingEntity)
			: null;

	const now = Date.now();
	const track = getTrack(player.name);
	const lastDeath = track.lastDeaths[track.lastDeaths.length - 1];

	const sameKillerRecently =
		!!atk &&
		!!lastDeath &&
		lastDeath.killerName === atk.name &&
		now - lastDeath.date < bountyCooldown;

	const moneyBeforeDeath = Math.max(0, Math.floor(getMoney(player.name)));
	const bountyPool =
		atk && !sameKillerRecently
			? Math.floor(moneyBeforeDeath * bountyRate)
			: 0;
	const deathPenalty = Math.floor(moneyBeforeDeath * deathPenaltyRate);

	if (atk && bountyPool > 0) {
		removeMoney(player.name, bountyPool);
		const killerGain = Math.floor(bountyPool * killerShare);
		addBounty(atk.name, killerGain);
	}

	if (deathPenalty > 0) {
		removeMoney(player.name, deathPenalty);
	}

	const killerName = atk?.name ?? "Environment";

	track.isDeathRecently = true;
	track.data = {
		killerName,
		date: now
	};
	track.lastDeaths.push(track.data);
	if (track.lastDeaths.length > 20) track.lastDeaths.shift();

	database.set("death.tracks", track, player.name);

	const killerHealth = atk
		? Math.floor(
				Number(
					/** @type {any} */ (atk.getComponent("minecraft:health"))
						?.currentValue ?? 0
				)
			)
		: 0;

	const deathLine = atk
		? `§7${player.name} §cwas slain by §e${atk.name} §7(§c:heart:${killerHealth}§7)§8.`
		: `§7${player.name} §cdied§8.`;

	const rewardLine =
		bountyPool > 0
			? ` §8[§eBounty §7+${currency}${Math.floor(
					bountyPool * killerShare
				)}§8, §cDeath §7-${currency}${deathPenalty}§8]`
			: ` §8[§7No bounty reward§8, §cDeath §7-${currency}${deathPenalty}§8]`;

	world.sendMessage({
		rawtext: [{ text: deathLine }, { text: rewardLine }]
	});

	for (const listener of world.getAllPlayers()) {
		listener.playSound("ambient.weather.thunder");
	}

	const heart = new ItemStack("miaw:heart", 1);
	heart.nameTag = `§r§u${player.name} §dHeart§f'§ds§r`;
	heart.setLore([
		`§r§6Obtained at §e${formatDate()}§f`,
		`§r§9× §3by §b${atk?.name ?? "Environment"}§f`
	]);

	player.dimension.spawnItem(heart, player.location);
});

world.afterEvents.itemUse.subscribe(event => {
	if (
		event.itemStack.typeId !== "miaw:heart" ||
		event.source.typeId !== "minecraft:player"
	)
		return;

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
		container.setItem(slot, undefined);
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
