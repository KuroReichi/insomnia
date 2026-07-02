import { world } from "@minecraft/server";

world.beforeEvents.entityHurt.subscribe(
	e => {
		if (e.hurtEntity.isValid) {
			const item = e.hurtEntity;
			const stack = item.getComponent("minecraft:item")?.itemStack;
			if (stack?.typeId === "miaw:heart") e.cancel = true;
		}
	},
	{
		entityFilter: {
			type: "minecraft:item"
		}
	}
);
