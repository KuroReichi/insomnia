import { EntityDieAfterEvent, EntityHurtAfterEvent, EntityItemDropAfterEvent, EntityItemPickupAfterEvent, PlayerBreakBlockAfterEvent, PlayerPlaceBlockAfterEvent, Player } from "@minecraft/server";
import { world } from "@minecraft/server";
import database from "./../../../core/database.js";

/** @typedef {{ id: string, amount: number }} StatisticEntry */

export const Statistics = {
	/**
	 * @param {StatisticEntry[]} data
	 * @param {string} id
	 * @param {number} [amount=1]
	 */
	store(data, id, amount = 1) {
		const exist = data.find(entry => entry.id === id);

		if (exist) exist.amount += amount;
		else data.push({ id, amount });

		data.sort((a, b) => a.id.localeCompare(b.id));
	},

	/**
	 * @param {string} type
	 * @param {string} [playerName]
	 * @returns {number}
	 */
	getTotal(type, playerName) {
		/** @type {StatisticEntry[]} */
		const data = playerName ? database.get(type, playerName) : database.get(type);
		if (!Array.isArray(data)) return 0;

		return data.reduce((total, item) => total + item.amount, 0);
	},

	items: {
		/** @param {EntityItemPickupAfterEvent} ev */
		pickup(ev) {
			if (!(ev.entity instanceof Player)) return;

			const data = database.get("stats.items_pickup", ev.entity.name) ?? [];

			for (const item of ev.items) {
				Statistics.store(data, item.typeId, item.amount);
			}

			database.set("stats.items_pickup", data, ev.entity.name);
		},

		/** @param {EntityItemDropAfterEvent} ev */
		drop(ev) {
			if (ev.entity.typeId !== "minecraft:player") return;

			/** @type {Player} */
			const player = /** @type {any} */ (ev.entity);
			const data = database.get("stats.items_drop", player.name) ?? [];

			for (const entity of ev.items) {
				const itemComp = /** @type {any} */ (entity.getComponent("minecraft:item"));
				if (!itemComp) continue;

				const item = itemComp.itemStack;
				Statistics.store(data, item.typeId, item.amount);
			}

			database.set("stats.items_drop", data, player.name);
		}
	},

	blocks: {
		/** @param {PlayerBreakBlockAfterEvent} ev */
		break(ev) {
			const data = database.get("stats.blocks_break", ev.player.name) ?? [];

			Statistics.store(data, ev.block.typeId);
			database.set("stats.blocks_break", data, ev.player.name);
		},

		/** @param {PlayerPlaceBlockAfterEvent} ev */
		place(ev) {
			const data = database.get("stats.blocks_place", ev.player.name) ?? [];

			Statistics.store(data, ev.block.typeId);
			database.set("stats.blocks_place", data, ev.player.name);
		}
	},

	/** @param {EntityDieAfterEvent} ev */
	KD(ev) {
		const dead = ev.deadEntity;
		const killer = ev.damageSource?.damagingEntity;

		if (dead instanceof Player) {
			const deaths = database.get("stats.deaths", dead.name) ?? [];

			Statistics.store(deaths, "total");
			database.set("stats.deaths", deaths, dead.name);
		}

		if (killer instanceof Player) {
			const kills = database.get("stats.kills", killer.name) ?? [];

			Statistics.store(kills, "total");
			database.set("stats.kills", kills, killer.name);
		}
	},

	/** @param {EntityHurtAfterEvent} ev */
	damage(ev) {
		const hurt = ev.hurtEntity;
		const attacker = ev.damageSource?.damagingEntity;

		if (hurt instanceof Player) {
			const taken = database.get("stats.damage_taken", hurt.name) ?? [];

			Statistics.store(taken, "total", ev.damage);
			database.set("stats.damage_taken", taken, hurt.name);
		}

		if (attacker instanceof Player) {
			const dealt = database.get("stats.damage_dealt", attacker.name) ?? [];

			Statistics.store(dealt, "total", ev.damage);
			database.set("stats.damage_dealt", dealt, attacker.name);
		}
	}
};

world.afterEvents.entityItemPickup.subscribe(Statistics.items.pickup, {
	entityFilter: {
		type: "minecraft:player"
	}
});

world.afterEvents.entityItemDrop.subscribe(Statistics.items.drop, {
	entityFilter: {
		type: "minecraft:player"
	}
});

world.afterEvents.playerBreakBlock.subscribe(Statistics.blocks.break);
world.afterEvents.playerPlaceBlock.subscribe(Statistics.blocks.place);
world.afterEvents.entityDie.subscribe(Statistics.KD);
world.afterEvents.entityHurt.subscribe(Statistics.damage);
