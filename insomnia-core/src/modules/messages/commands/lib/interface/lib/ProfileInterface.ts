import {
	CommandError,
	CustomCommandSource,
	CustomCommandParamType,
	CommandPermissionLevel,
	system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
	customCommandRegistry.registerCommand(
		{
			"name": "profile",
			"description": "",
			"permissionLevel": CommandPermissionLevel.Any,
			"cheatsRequired": false,
			"optionalParameters": [
				{
					"name": "target",
					"type": CustomCommandParamType.PlayerSelector
				}
			]
		},
		(origin, args: ): void => {
			if (origin.sourceType !== CustomCommandSource.Entity) {
			}
		}
	);
});
