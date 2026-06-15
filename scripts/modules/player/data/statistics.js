import {
	EntityDieAfterEvent,
	EntityHurtAfterEvent,
	EntityItemDropAfterEvent,
	EntityItemPickupAfterEvent,
	ItemStack,
	PlayerBreakBlockAfterEvent,
	PlayerPlaceBlockAfterEvent
} from "@minecraft/server";
import { world, system } from "@minecraft/server";
import database from "./../../../core/database.js";

export const Statistics = {
	/**
	 * @name store
	 * @param {Array<{ id: string, amount: number }>} data
	 * @param {string} id
	 * @param {number} amount
	 */
	store(data, id, amount = 1) {
		const exist = data.find(entry => entry.id === id);
		if (exist) {
			exist.amount += amount;
		} else {
			data.push({ id, amount });
		}
		data.sort((a, b) => a.id.localeCompare(b.id));
	},

	/**
	 * @name getTotalAmount
	 * @param {string} type
	 * @param {string=} playerName
	 */
	getTotal(type, playerName) {
		/** @type {Array<{ id: string, amount: number }>} */
		const data = playerName ? database.get(type, playerName) : database.get(type);

		if (!Array.isArray(data)) {
			return 0;
		}

		return data.reduce((total, item) => total + item.amount, 0);
	},

	items: {
		/**
		 * @name pickup
		 * @param {EntityItemPickupAfterEvent} ev
		 */
		pickup(ev) {
			const data = database.get("stats.items_pickup", ev.entity.name) ?? [];

			/**
			 * @name StoreData
			 * @param {ItemStack} item
			 */
			function StoreData(item) {
				Statistics.store(data, item.typeId, item.amount);
			}

			ev.items.forEach(StoreData);
			database.set("stats.items_pickup", data, ev.entity.name);
		},

		/**
		 * @name drop
		 * @param {EntityItemDropAfterEvent} ev
		 */
		drop(ev) {
			const data = database.get("stats.items_drop", ev.entity.name) ?? [];

			/**
			 * @name StoreData
			 * @param {ItemStack} item
			 */
			function StoreData(item) {
				Statistics.store(data, item.typeId, item.amount);
			}

			ev.items.forEach(StoreData);
			database.set("stats.items_drop", data, ev.entity.name);
		}
	},
	blocks: {
		break(ev) {
			const data = database.get("stats.blocks_break", ev.player.name) ?? [];
			Statistics.store(data, ev.block.typeId, 1);
			database.set("stats.blocks_break", data, ev.player.name);
		},
		place(ev) {
			const data = database.get("stats.blocks_place", ev.player.name) ?? [];
			Statistics.store(data, ev.block.typeId, 1);
			database.set("stats.blocks_place", data, ev.player.name);
		}
	},
	KD(ev) {
		const dead = ev.deadEntity;
		const killer = ev.damageSource?.damagingEntity;

		if (dead?.typeId === "minecraft:player") {
			const deaths = database.get("stats.deaths", dead.name) ?? [];
			Statistics.store(deaths, "total", 1);
			database.set("stats.deaths", deaths, dead.name);
		}
		if (killer?.typeId === "minecraft:player") {
			const kills = database.get("stats.kills", killer.name) ?? [];
			Statistics.store(kills, "total", 1);
			database.set("stats.kills", kills, killer.name);
		}
	},
	damage(ev) {
		const hurt = ev.hurtEntity;
		const attacker = ev.damageSource?.damagingEntity;

		if (hurt?.typeId === "minecraft:player") {
			const taken = database.get("stats.damage_taken", hurt.name) ?? [];
			Statistics.store(taken, "total", ev.damage);
			database.set("stats.damage_taken", taken, hurt.name);
		}

		if (attacker?.typeId === "minecraft:player") {
			const dealt = database.get("stats.damage_dealt", attacker.name) ?? [];
			Statistics.store(dealt, "total", ev.damage);
			database.set("stats.damage_dealt", dealt, attacker.name);
		}
	}
};

world.afterEvents.entityItemPickup.subscribe(Statistics.items.pickup, { entityFilter: { type: "minecraft:player" } });
world.afterEvents.entityItemDrop.subscribe(Statistics.items.drop, { entityFilter: { type: "minecraft:player" } });
world.afterEvents.playerBreakBlock.subscribe(Statistics.blocks.break);
world.afterEvents.playerPlaceBlock.subscribe(Statistics.blocks.place);
world.afterEvents.entityDie.subscribe(Statistics.KD);
world.afterEvents.entityHurt.subscribe(Statistics.damage);
