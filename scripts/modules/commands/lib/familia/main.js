import { world } from "@minecraft/server";
import { registerCommand } from "../../core/registry";
import { configs } from "../../../../core/configs";
import database from "./../../../../core/database.js";

const Structure = {
	name: "familia",
	aliases: ["fam", "f"],
	description: "Familia",
	children: [
		{
			name: "create",
			type: "literal",
			children: [
				{
					name: "abbreviation",
					type: "argument",
					argType: "string",
					children: [
						{
							name: "full",
							type: "argument",
							argType: "string",
							run: Familia.create,
						},
					],
					run: Familia.create,
				},
			],
			run: Familia.error.argument,
			/**
			 * Stored to Familia database.set(`${UID2048()}.power`, {Familia}, "familia")
			 * @property {number} power - The total value are accumulated from all members power
			 */

			/**
			 * Stored to Familia database.set(`${UID2048()}.name`, {Familia}, "familia")
			 * @type {FamiliaName}
			 */

			/**
			 * Stored to Familia database.set(`${UID2048()}.data`, {Familia}, "familia")
			 * @typedef {Familia}
			 * @property {string} description
			 * @property {string[]} tags
			 * @property {string} motd
			 * @property {string} uid - 2048-bit UID
			 * @property {string} founder
			 * @property {boolean} open
			 * @property {number} since - Date Creation : new Date().valueOf()
			 * @property {string[FamiliaRelations]} relations
			 */

			/**
			 * @typedef {FamiliaName}
			 * @property {string} abbreviation - Max 5  Characters (Bisa dipakai kembali oleh player lain)
			 * @property {string} fullName     - Max 28 Characters (Hanya bisa dipakai 1 Familia)
			 */

			/**
			 * @typedef {FamiliaRelations}
			 * @property {string} uid
			 * @property {string} type - ally, enemy, neutral
			 * @property {string} since
			 */

			/**
			 * Stored to Player database.set("familia", {FamiliaPlayer}, player.name)
			 * @typedef {FamiliaPlayer}
			 * @property {boolean} haveFamilia
			 * @property {FamiliaData} data
			 */

			/**
			 * @typedef {FamiliaData}
			 * @property {string} uid
			 * @property {string} rank
			 * @property {string} title
			 * @property {number} power
			 * @property {number} since
			 */
		},
		{
			name: "join",
			type: "literal",
			children: [
				{
					name: "faction",
					type: "argument",
					argType: "string",
					run: Familia.join,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "leave",
			type: "literal",
			run: Familia.leave,
		},
		{
			name: "home",
			type: "literal",
			run: Familia.teleport.home,
		},
		{
			name: "sethome",
			type: "literal",
			run: Familia.teleport.sethome,
		},
		{
			name: "chat",
			type: "literal",
			children: [
				{
					name: "mode",
					type: "argument",
					argType: "enum",
					values: ["familia", "ally", "public"],
					run: Familia.chat_mode,
				},
			],
			run: Familia.chat_toggle,
		},
		{
			name: "invite",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					run: Familia.invite,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "kick",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					run: Familia.kick,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "setrank",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					children: [
						{
							name: "rank",
							type: "argument",
							argType: "enum",
							values: [
								"member",
								"officer",
								"co-leader", // Max 2
								"agent",
							],
							run: Familia.setrank,
						},
					],
					run: Familia.error.argument,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "promote",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					run: Familia.promote,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "demote",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					run: Familia.demote,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "title",
			type: "literal",
			children: [
				{
					name: "player",
					type: "argument",
					argType: "player",
					children: [
						{
							name: "title",
							type: "argument",
							argType: "string",
							run: Familia.setTitle,
						},
					],
					run: Familia.error.argument,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "setname",
			type: "literal",
			children: [
				{
					name: "abbreviation",
					type: "literal",
					children: [
						{
							name: "name",
							type: "argument",
							argType: "string",
							run: Familia.setAbbreviation,
						},
					],
					run: Familia.error.argument,
				},
				{
					name: "fullname",
					type: "literal",
					children: [
						{
							name: "name",
							type: "argument",
							argType: "string",
							run: Familia.setFullname,
						},
					],
					run: Familia.error.argument,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "motd",
			type: "literal",
			children: [
				{
					name: "motd",
					type: "argument",
					argType: "string",
					run: Familia.motd,
				},
			],
			run: Familia.error.argument,
		},
		{
			name: "disband",
			type: "literal",
			children: [
				{
					name: "confirm",
					type: "argument",
					argType: "enum",
					values: ["confirm", "cancel"],
					run: Familia.disband,
				},
			],
			run: Familia.disband,
		},
		{
			name: "help",
			type: "literal",
			children: [
				{
					name: "command",
					type: "argument",
					argType: "string",
					run: Familia.help,
				},
			],
			run: Familia.help,
		},
	],
	run: Familia.help,
};

registerCommand(Structure);

const Familia = {
	error: {
		argument(player) {
			return this.help(player, {});
		},
	},

	help(player, args = {}) {
		const q = String(args.command ?? "")
			.trim()
			.toLowerCase();

		const list = [
			[
				"create",
				configs.commandPrefix +
					"familia create <abbreviation> <full name>",
			],
			["join", configs.commandPrefix + "familia join <faction>"],
			["leave", configs.commandPrefix + "familia leave"],
			["home", configs.commandPrefix + "familia home"],
			["sethome", configs.commandPrefix + "familia sethome"],
			[
				"chat",
				configs.commandPrefix + "familia chat [familia|ally|public]",
			],
			["invite", configs.commandPrefix + "familia invite <player>"],
			["kick", configs.commandPrefix + "familia kick <player>"],
			[
				"setrank",
				configs.commandPrefix +
					"familia setrank <player> <member|officer|co-leader|agent>",
			],
			["promote", configs.commandPrefix + "familia promote <player>"],
			["demote", configs.commandPrefix + "familia demote <player>"],
			["title", configs.commandPrefix + "familia title <player> <title>"],
			[
				"setname",
				configs.commandPrefix +
					"familia setname abbreviation <name> | " +
					configs.commandPrefix +
					"familia setname fullname <name>",
			],
			["motd", configs.commandPrefix + "familia motd <message>"],
			["disband", configs.commandPrefix + "familia disband confirm"],
			["help", configs.commandPrefix + "familia help <command>"],
		];

		if (!q) {
			player.sendMessage("§6§l=== Familia Help ===");
			for (const [, usage] of list) {
				player.sendMessage(`§e- §f${usage}`);
			}
			return;
		}

		const found = list.find(([name]) => name === q);
		if (!found) {
			player.sendMessage(`§cUnknown familia command: §f${q}`);
			return;
		}

		player.sendMessage(`§6§l=== Familia: ${found[0]} ===`);
		player.sendMessage(`§f${found[1]}`);
	},

	create(player, args) {
		const abbreviation = String(args.abbreviation ?? "").trim();
		const fullName = String(args.full ?? "").trim();

		if (!abbreviation || !fullName)
			return this.help(player, { command: "create" });
		if (abbreviation.length > 5)
			return send(player, "§cAbbreviation max length is §e5§c.");
		if (fullName.length > 28)
			return send(player, "§cFull name max length is §e28§c.");
		if (getPlayerFamily(player))
			return send(player, "§cYou already have a familia.");

		const conflict = resolveFamily(abbreviation) || resolveFamily(fullName);
		if (conflict)
			return send(
				player,
				"§cA familia with that abbreviation or name already exists.",
			);

		const family = ensureFamilyShape({
			uid: uid(),
			abbreviation,
			fullName,
			description: "",
			tags: [],
			motd: "",
			founder: player.name,
			open: true,
			since: Date.now(),
			home: null,
			relations: [],
			invites: [],
			chatMode: "familia",
			members: {},
		});

		family.members[player.name] = memberData("agent", "Founder", 0);
		saveFamily(family);

		setPlayerFamily(player, {
			uid: family.uid,
			rank: "agent",
			title: "Founder",
			power: 0,
			since: Date.now(),
			chatMode: family.chatMode,
		});

		send(player, `§aFamilia §e${familyLabel(family)}§a created.`);
	},

	join(player, args) {
		const family = resolveFamily(args.faction);
		if (!family) return send(player, "§cFamilia not found.");
		if (getPlayerFamily(player))
			return send(player, "§cYou already have a familia.");

		ensureFamilyShape(family);

		if (!family.open && !family.invites.includes(player.name)) {
			return send(player, "§cThis familia is closed.");
		}

		family.members[player.name] = memberData("member", "Member", 0);
		family.invites = family.invites.filter((name) => name !== player.name);
		saveFamily(family);

		setPlayerFamily(player, {
			uid: family.uid,
			rank: "member",
			title: "Member",
			power: 0,
			since: Date.now(),
			chatMode: family.chatMode,
		});

		send(player, `§aYou joined §e${familyLabel(family)}§a.`);
	},

	leave(player) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");

		ensureFamilyShape(family);

		if (family.founder === player.name) {
			if (Object.keys(family.members).length > 1) {
				return send(
					player,
					"§cFounder cannot leave. Use §e" +
						configs.commandPrefix +
						"familia disband confirm§c or transfer ownership first.",
				);
			}
			return this.disband(player, { confirm: "confirm" });
		}

		delete family.members[player.name];
		saveFamily(family);
		clearPlayerFamily(player);

		send(player, `§eYou left §f${familyLabel(family)}§e.`);
	},

	teleport: {
		home(player) {
			const family = getPlayerFamily(player);
			if (!family) return send(player, "§cYou are not in a familia.");
			if (!family.home?.location)
				return send(player, "§cFamilia home is not set.");

			try {
				player.teleport(family.home.location, {
					dimension: world.getDimension(
						family.home.dimension ?? "overworld",
					),
				});
				send(
					player,
					`§aTeleported to §e${familyLabel(family)}§a home.`,
				);
			} catch {
				send(player, "§cFailed to teleport to familia home.");
			}
		},

		sethome(player) {
			const family = getPlayerFamily(player);
			if (!family) return send(player, "§cYou are not in a familia.");
			if (!canManage(family, player.name))
				return send(
					player,
					"§cYou don't have permission to set familia home.",
				);

			family.home = {
				dimension: player.dimension.id,
				location: {
					x: player.location.x,
					y: player.location.y,
					z: player.location.z,
				},
			};

			saveFamily(family);
			send(player, `§aFamilia home set for §e${familyLabel(family)}§a.`);
		},
	},

	chat_toggle(player) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");

		const playerData = getPlayerFamilyData(player);
		const current =
			playerData?.data?.chatMode ?? family.chatMode ?? "familia";
		const next =
			CHAT_MODES[(CHAT_MODES.indexOf(current) + 1) % CHAT_MODES.length];

		return this.chat_mode(player, { mode: next });
	},

	chat_mode(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");

		const mode = String(args.mode ?? "").toLowerCase();
		if (!CHAT_MODES.includes(mode))
			return send(player, "§cInvalid chat mode.");

		family.chatMode = mode;
		saveFamily(family);

		const playerData = getPlayerFamilyData(player);
		if (playerData?.data) {
			playerData.data.chatMode = mode;
			setPlayerFamily(player, playerData.data);
		}

		send(player, `§aFamilia chat mode set to §e${mode}§a.`);
	},

	invite(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to invite.");

		const target = args.player;
		if (!target) return send(player, "§cTarget player not found.");
		if (getPlayerFamily(target))
			return send(player, "§cThat player already has a familia.");
		if (family.members[target.name])
			return send(player, "§cThat player is already a member.");

		ensureFamilyShape(family);

		if (!family.invites.includes(target.name)) {
			family.invites.push(target.name);
		}

		saveFamily(family);
		send(player, `§aInvite sent to §e${target.name}§a.`);
		send(
			target,
			`§e${player.name} §ainvited you to §f${familyLabel(family)}§a.`,
		);
	},

	kick(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to kick.");

		const target = args.player;
		if (!target) return send(player, "§cTarget player not found.");
		if (target.name === family.founder)
			return send(player, "§cYou cannot kick the founder.");

		ensureFamilyShape(family);

		if (!family.members[target.name])
			return send(player, "§cThat player is not in your familia.");

		delete family.members[target.name];
		saveFamily(family);
		clearPlayerFamily(target);

		send(
			player,
			`§cKicked §f${target.name}§c from §e${familyLabel(family)}§c.`,
		);
		send(target, `§cYou were kicked from §e${familyLabel(family)}§c.`);
	},

	setrank(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to set rank.");

		const target = args.player;
		const rank = String(args.rank ?? "").toLowerCase();

		if (!target) return send(player, "§cTarget player not found.");
		if (!RANKS.includes(rank)) return send(player, "§cInvalid rank.");
		if (target.name === family.founder)
			return send(player, "§cYou cannot change the founder rank.");

		const member = memberRecord(family, target.name);
		if (!member)
			return send(player, "§cThat player is not in your familia.");

		member.rank = rank;
		family.members[target.name] = member;
		saveFamily(family);

		const targetData = getPlayerFamilyData(target);
		if (targetData?.data) {
			targetData.data.rank = rank;
			setPlayerFamily(target, targetData.data);
		}

		send(player, `§aSet §e${target.name}§a rank to §f${rank}§a.`);
		send(target, `§aYour familia rank is now §f${rank}§a.`);
	},

	promote(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to promote.");

		const target = args.player;
		if (!target) return send(player, "§cTarget player not found.");
		if (target.name === family.founder)
			return send(player, "§cYou cannot promote the founder.");

		const member = memberRecord(family, target.name);
		if (!member)
			return send(player, "§cThat player is not in your familia.");

		const i = rankIndex(member.rank);
		if (i < 0 || i >= RANKS.length - 1)
			return send(
				player,
				"§cThat player is already at the highest rank.",
			);

		member.rank = RANKS[i + 1];
		family.members[target.name] = member;
		saveFamily(family);

		const targetData = getPlayerFamilyData(target);
		if (targetData?.data) {
			targetData.data.rank = member.rank;
			setPlayerFamily(target, targetData.data);
		}

		send(player, `§aPromoted §e${target.name}§a to §f${member.rank}§a.`);
		send(target, `§aYou were promoted to §f${member.rank}§a.`);
	},

	demote(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to demote.");

		const target = args.player;
		if (!target) return send(player, "§cTarget player not found.");
		if (target.name === family.founder)
			return send(player, "§cYou cannot demote the founder.");

		const member = memberRecord(family, target.name);
		if (!member)
			return send(player, "§cThat player is not in your familia.");

		const i = rankIndex(member.rank);
		if (i <= 0)
			return send(player, "§cThat player is already at the lowest rank.");

		member.rank = RANKS[i - 1];
		family.members[target.name] = member;
		saveFamily(family);

		const targetData = getPlayerFamilyData(target);
		if (targetData?.data) {
			targetData.data.rank = member.rank;
			setPlayerFamily(target, targetData.data);
		}

		send(player, `§eDemoted §f${target.name}§e to §f${member.rank}§e.`);
		send(target, `§cYou were demoted to §f${member.rank}§c.`);
	},

	setTitle(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to set title.");

		const target = args.player;
		const title = String(args.title ?? "").trim();

		if (!target) return send(player, "§cTarget player not found.");
		if (!title) return send(player, "§cTitle cannot be empty.");

		const member = memberRecord(family, target.name);
		if (!member)
			return send(player, "§cThat player is not in your familia.");

		member.title = title;
		family.members[target.name] = member;
		saveFamily(family);

		const targetData = getPlayerFamilyData(target);
		if (targetData?.data) {
			targetData.data.title = title;
			setPlayerFamily(target, targetData.data);
		}

		send(player, `§aSet title of §e${target.name}§a to §f${title}§a.`);
		send(target, `§aYour familia title is now §f${title}§a.`);
	},

	setAbbreviation(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (family.founder !== player.name)
			return send(
				player,
				"§cOnly the founder can change the abbreviation.",
			);

		const name = String(args.name ?? "").trim();
		if (!name) return send(player, "§cAbbreviation cannot be empty.");
		if (name.length > 5)
			return send(player, "§cAbbreviation max length is §e5§c.");

		const conflict = resolveFamily(name);
		if (conflict && conflict.uid !== family.uid)
			return send(player, "§cThat abbreviation is already used.");

		deleteFamilyNames(family);
		family.abbreviation = name;
		saveFamily(family);

		send(player, `§aFamilia abbreviation changed to §e${name}§a.`);
	},

	setFullname(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (family.founder !== player.name)
			return send(player, "§cOnly the founder can change the full name.");

		const name = String(args.name ?? "").trim();
		if (!name) return send(player, "§cFull name cannot be empty.");
		if (name.length > 28)
			return send(player, "§cFull name max length is §e28§c.");

		const conflict = resolveFamily(name);
		if (conflict && conflict.uid !== family.uid)
			return send(player, "§cThat full name is already used.");

		deleteFamilyNames(family);
		family.fullName = name;
		saveFamily(family);

		send(player, `§aFamilia full name changed to §e${name}§a.`);
	},

	motd(player, args) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");
		if (!canManage(family, player.name))
			return send(player, "§cYou don't have permission to change MOTD.");

		const motd = String(args.motd ?? "").trim();
		if (!motd) return send(player, "§cMOTD cannot be empty.");

		family.motd = motd;
		saveFamily(family);

		send(player, "§aFamilia MOTD updated.");
	},

	disband(player, args = {}) {
		const family = getPlayerFamily(player);
		if (!family) return send(player, "§cYou are not in a familia.");

		const confirm = String(args.confirm ?? "").toLowerCase();
		if (confirm !== "confirm") {
			send(
				player,
				"§eUse §f" +
					configs.commandPrefix +
					"familia disband confirm §eto disband your familia.",
			);
			return;
		}

		if (family.founder !== player.name) {
			return send(player, "§cOnly the founder can disband the familia.");
		}

		ensureFamilyShape(family);

		for (const memberName of Object.keys(family.members)) {
			database.delete("familia", memberName);
			database.player({ name: memberName }).set("chat-mode", "public");
		}

		deleteFamilyNames(family);
		removeFamilyIndex(family.uid);
		database.delete(family.uid, FAMILY_KEY);

		send(player, `§cFamilia §f${familyLabel(family)}§c disbanded.`);
	},
};
