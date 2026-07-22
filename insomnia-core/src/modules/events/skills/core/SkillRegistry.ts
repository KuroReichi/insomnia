import { Player, RawMessage } from "@minecraft/server";
import { Database } from "../../../../core/Database.js";

type SkillTarget =
	| {
			type: "entity";
			mode: "single";
			entityMax: 1;
	  }
	| {
			type: "entity";
			mode: "area";
			maxEntities: number;
			radius: number;
	  }
	| {
			type: "block";
			mode: "single";
	  }
	| {
			type: "block";
			mode: "area";
			maxBlocks: number;
			radius: number;
	  };

type SkillRunContext = {
	player: Player;
	database: Database;
	skill: SkillRegistry | SkillEvolution;
};

type SkillRegistry = {
	/** Item ID - Required */
	itemId: ItemTypeIDs;
	/** Skill Name. Can't be duplicated */
	name: string;
	/** Skill Rating, it is hard or easy mechanism */
	rating: "Easy" | "Medium" | "Hard";
	/** Skill Description */
	description: string | RawMessage | (string | RawMessage)[];
	/** Skill Type, Ex: Burst, DPS, or anything */
	type: string;
	target: SkillTarget;
	/** Evolution Tree */
	evo?: SkillEvolution[];
	/** Skill Type, Ex: Burst, DPS, or anything */
	activation: "any" | "stand" | "jump" | "sneak";
	cast: {
		/** How long should player use the item a.k.a right click to cast this skill */
		duration: number;
		/**
		 * The Effective Range is 1-255 blocks
		 * (but it can be lower if the simulation distance on the server is not high)
		 */
		range: number;
		/** Wether to slowdown player while casting */
		slowdown?: boolean;
	};
	run: (context: SkillRunContext) => void | Promise<void>;
};

type SkillEvolution = {
	/** Skill Name. Can't be duplicated */
	name: string;
	/** Skill Rating, it is hard or easy mechanism */
	rating: "Easy" | "Medium" | "Hard";
	unlockCondition: Record<string, unknown>;
	/** Skill Description */
	description: string | RawMessage | (string | RawMessage)[];
	/** Skill Type, Ex: Burst, DPS, or anything */
	type: string;
	target: SkillTarget;
	/** Evolution Tree */
	evo?: SkillEvolution[];
	/** Skill Type, Ex: Burst, DPS, or anything */
	activation: "any" | "stand" | "jump" | "sneak";
	cast: {
		/** How long should player use the item a.k.a right click to cast this skill */
		duration: number;
		/**
		 * The Effective Range is 1-255 blocks
		 * (but it can be lower if the simulation distance on the server is not high)
		 */
		range: number;
		/** Wether to slowdown player while casting */
		slowdown?: boolean;
	};
	run: (context: SkillRunContext) => void | Promise<void>;
};

export type EvoConditionSoul = {
	soulsNeeded: number;
};

const database = new Database();
const SkillMap = new Map<string, SkillRegistry>();

export function registerSkill(data: SkillRegistry[]): void {
	for (const skill of data) {
		if (SkillMap.has(skill.name)) continue;
		SkillMap.set(skill.name, skill);
	}
}

export function getAllSkill(): SkillRegistry[] {
	return [...SkillMap.values()];
}

export function getSkill(name: string): SkillRegistry | undefined {
	return SkillMap.get(name);
}

function findEvolutionByName(
	evolutions: SkillEvolution[] | undefined,
	name: string
): SkillEvolution | undefined {
	if (!evolutions) return undefined;

	for (const evo of evolutions) {
		if (evo.name === name) return evo;

		const found = findEvolutionByName(evo.evo, name);
		if (found) return found;
	}

	return undefined;
}

export function getEvolutions(name: string): SkillEvolution[] | undefined {
	return SkillMap.get(name)?.evo;
}

export function getEvolution(name: string): SkillEvolution | undefined {
	for (const skill of SkillMap.values()) {
		const found = findEvolutionByName(skill.evo, name);
		if (found) return found;
	}
	return undefined;
}

export function CastSkill(name: string, player: Player): void {
	const skill = getSkill(name);
	if (!skill) return;

	void skill.run({
		player,
		database,
		skill
	});
}
