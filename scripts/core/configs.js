import * as DATA from "@minecraft/vanilla-data";

export const configs = {
	commandPrefix: "!",
	server: {
		name: "Insomnia Lifesteal",
		subname: undefined,
		founder: "KuroReichii",
		license: "MIT",
		production: "Legiun Studio"
	},
	modules: {
		realtime: {
			enabled: true,
			timezone: "Asia/Jakarta"
		},
		// ! CUMA WORK DI AWAL worldLoad !
		// ! ONLY WORK AT FIRST WORLD LOAD EVENT !
		regionProtect: [
			{
				/** @type {{x:number,y:number,z:number}|"spawn"} */
				location: "spawn",
				dimension: DATA.MinecraftDimensionTypes.Overworld,
				data: {
					type: "radius",
					value: "500",
					permission: {
						pvp: false,
						blocks: {
							break: false,
							place: false
						},
						items: {
							pickup: true,
							drop: true
						},
						entities: {
							animals: false,
							monster: false
						}
					}
				}
			}
		],
		economy: {
			currency: "$",
			default: 10000
		},
		bounty: {
			min: 1000
		}
	}
};
