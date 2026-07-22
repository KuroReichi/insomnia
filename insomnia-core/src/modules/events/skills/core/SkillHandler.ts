import { Player, system, world } from "@minecraft/server";
import { CastSkill, getAllSkill } from "./SkillRegistry.js";

const castingPlayers = new Set<string>();

function getSkillByItemId(itemId: string) {
	return getAllSkill().find((skill) => skill.itemId === itemId);
}

(() => {
	world.beforeEvents.itemUse.subscribe((e) => {
		const player = e.source;
		if (!(player instanceof Player)) return;

		const item = e.itemStack;
		if (!item) return;

		const skill = getSkillByItemId(item.typeId);
		if (!skill) return;

		if (skill.activation === "sneak" && !player.isSneaking) return;
		if (skill.activation === "stand" && player.isSneaking) return;

		if (skill.activation === "jump" && !player.isJumping) {
			return;
		}

		if (castingPlayers.has(player.id)) return;
		castingPlayers.add(player.id);

		const castTicks = Math.max(0, skill.cast.duration);

		if (skill.cast.slowdown) {
			void player.addEffect("slowness", castTicks + 20, {
				amplifier: 4,
				showParticles: false
			});
		}

		system.runTimeout(() => {
			castingPlayers.delete(player.id);

			if (!player.isValid) return;
			CastSkill(skill.name, player);
		}, castTicks);
	});
})();
