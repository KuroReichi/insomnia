import { Player, world, ItemStack } from "@minecraft/server";
import { configs } from "../../../core/configs";
import database from "../../../core/database";
/**
 * @typedef {{killerName:string,date:number}} DeathEntry
 * @typedef {{isDeathRecently:boolean,data:DeathEntry,lastDeaths:DeathEntry[]}} DeathTrack
 */

const currency = configs.modules.economy.currency;
const bountyRate = 0.3;
const killerShare = 0.7;
const deathPenaltyRate = 0.2;
const bountyCooldown = 30 * 60 * 1000;

/** @param {string} name */
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

/** @param {string} name */
function getTrack(name) {
	return /** @type {DeathTrack} */ (
		database.get("death.tracks", name) ?? {
			isDeathRecently: false,
			data: { killerName: "", date: 0 },
			lastDeaths: []
		}
	);
}

world.afterEvents.entityDie.subscribe(
	event => {
		/** @type {Player} */
		const player = /** @type {Player} */ (event.deadEntity);
		const damager = event.damageSource?.damagingEntity;
		if (!(damager instanceof Player)) return;
		/** @type {Player} */
		const atk = damager;

		const now = Date.now();
		const track = getTrack(player.name);
		const lastDeath = track.lastDeaths[track.lastDeaths.length - 1];
		const sameKillerRecently =
			!!lastDeath &&
			lastDeath.killerName === atk.name &&
			now - lastDeath.date < bountyCooldown;

		const moneyBeforeDeath = Math.max(0, Math.floor(getMoney(player.name)));
		const bountyPool = sameKillerRecently
			? 0
			: Math.floor(moneyBeforeDeath * bountyRate);
		const deathPenalty = Math.floor(moneyBeforeDeath * deathPenaltyRate);

		if (bountyPool > 0) {
			removeMoney(player.name, bountyPool);
			const killerGain = Math.floor(bountyPool * killerShare);
			const sinkLoss = bountyPool - killerGain;
			addBounty(atk.name, killerGain);
			if (sinkLoss > 0) {
				// sinkLoss intentionally removed from economy
			}
		}

		if (deathPenalty > 0) {
			removeMoney(player.name, deathPenalty);
		}

		track.isDeathRecently = true;
		track.data = {
			killerName: atk.name,
			date: now
		};
		track.lastDeaths.push(track.data);
		if (track.lastDeaths.length > 20) track.lastDeaths.shift();

		database.set("death.tracks", track, player.name);

		world.sendMessage({
			rawtext: [
				{
					text: `§7${player.name} §cwas slain by §e${atk.name} §7(§c:heart:${Math.floor(Number(atk.getComponent("minecraft:health")?.currentValue))}§7)§8.`
				},
				bountyPool > 0
					? {
							text: ` §8[§eBounty §7+${currency}${Math.floor(bountyPool * killerShare)}§8, §cDeath §7-${currency}${deathPenalty}§8]`
						}
					: {
							text: ` §8[§7No bounty reward§8]`
						}
			]
		});

		world
			.getAllPlayers()
			.forEach(listener =>
				listener.dimension.runCommand(
					`playsound ambient.weather.thunder ${player.name}`
				)
			);

		const formatDate = (date = new Date()) =>
			new Intl.DateTimeFormat("en-GB", {
				timeZone: "Asia/Jakarta",
				day: "2-digit",
				month: "2-digit",
				year: "numeric"
			}).format(date);

		const heart = new ItemStack("miaw:heart", 1);
		heart.nameTag = `§r§u${player.name} §dHeart§f'§ds§r`;
		heart.setLore([
			{ text: `§r§6Obtained at §e${formatDate()}§f\n` },
			{ text: `  §r§9× §3by §b${atk.name}§f` }
		]);

		world
			.getDimension(player.dimension.id)
			.spawnItem(heart, player.location);
	},
	{
		entityTypes: ["minecraft:player"]
	}
);

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

	const slot = /** @type {number} */ (container.find(event.itemStack));

	/** @type {ItemStack} */
	const item = event.itemStack.clone();
	item.amount--;
	container.setItem(slot, item);

	if (Math.floor(health.defaultValue) >= 40) {
		player.sendMessage({
			text: "§l§6> §r§cYou reached max health limit!"
		});
		player.playSound("note.bass");
		return;
	}

	const nextHealth = Math.floor(health.defaultValue + 2);

	player.runCommand(`event entity "${player.name}" miaw:hp_${nextHealth}`);
	player.sendMessage({
		text: `§l§6> §r§cHealth §7increased to §e${nextHealth}`
	});

	player.runCommand(
		`execute as "${player.name}" at @s run playsound random.levelup @a ~~~`
	);
});
