package com.kuroreichi.autocommand;

import com.terraformersmc.modmenu.api.ConfigScreenFactory;
import com.terraformersmc.modmenu.api.ModMenuApi;
import dev.isxander.yacl3.api.ConfigCategory;
import dev.isxander.yacl3.api.Option;
import dev.isxander.yacl3.api.YetAnotherConfigLib;
import dev.isxander.yacl3.api.controller.BooleanControllerBuilder;
import dev.isxander.yacl3.api.controller.FloatFieldControllerBuilder;
import dev.isxander.yacl3.api.controller.IntegerSliderControllerBuilder;
import dev.isxander.yacl3.api.controller.StringControllerBuilder;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class AutoCommandModMenu implements ModMenuApi {
    @Override
    public ConfigScreenFactory<?> getModConfigScreenFactory() {
        return this::createConfigScreen;
    }

    private Screen createConfigScreen(Screen parent) {
        AutoCommandConfig c = AutoCommandClient.CONFIG;

        Option<Boolean> feedEnabled = Option.<Boolean>createBuilder()
                .name(Component.translatable("config.auto_command.feed.enabled"))
                .binding(c.autoFeed, () -> c.autoFeed, value -> c.autoFeed = value)
                .controller(BooleanControllerBuilder::create)
                .build();
        Option<Integer> hunger = Option.<Integer>createBuilder()
                .name(Component.translatable("config.auto_command.feed.threshold"))
                .binding(c.hungerThreshold, () -> c.hungerThreshold, value -> c.hungerThreshold = value)
                .controller(option -> IntegerSliderControllerBuilder.create(option).range(0, 20).step(1))
                .build();
        Option<String> feedCommand = Option.<String>createBuilder()
                .name(Component.translatable("config.auto_command.feed.command"))
                .binding(c.feedCommand, () -> c.feedCommand, value -> c.feedCommand = value)
                .controller(StringControllerBuilder::create)
                .build();

        Option<Boolean> healEnabled = Option.<Boolean>createBuilder()
                .name(Component.translatable("config.auto_command.heal.enabled"))
                .binding(c.autoHeal, () -> c.autoHeal, value -> c.autoHeal = value)
                .controller(BooleanControllerBuilder::create)
                .build();
        Option<Float> health = Option.<Float>createBuilder()
                .name(Component.translatable("config.auto_command.heal.threshold"))
                .binding(c.healthThreshold, () -> c.healthThreshold, value -> c.healthThreshold = value)
                .controller(FloatFieldControllerBuilder::create)
                .build();
        Option<String> healCommand = Option.<String>createBuilder()
                .name(Component.translatable("config.auto_command.heal.command"))
                .binding(c.healCommand, () -> c.healCommand, value -> c.healCommand = value)
                .controller(StringControllerBuilder::create)
                .build();

        Option<Boolean> fixEnabled = Option.<Boolean>createBuilder()
                .name(Component.translatable("config.auto_command.fix.enabled"))
                .binding(c.autoFix, () -> c.autoFix, value -> c.autoFix = value)
                .controller(BooleanControllerBuilder::create)
                .build();
        Option<Integer> durability = Option.<Integer>createBuilder()
                .name(Component.translatable("config.auto_command.fix.threshold"))
                .binding(c.durabilityThresholdPercent, () -> c.durabilityThresholdPercent,
                        value -> c.durabilityThresholdPercent = value)
                .controller(option -> IntegerSliderControllerBuilder.create(option).range(0, 100).step(1))
                .build();
        Option<String> fixCommand = Option.<String>createBuilder()
                .name(Component.translatable("config.auto_command.fix.command"))
                .binding(c.fixCommand, () -> c.fixCommand, value -> c.fixCommand = value)
                .controller(StringControllerBuilder::create)
                .build();

        Option<Integer> cooldown = Option.<Integer>createBuilder()
                .name(Component.translatable("config.auto_command.general.cooldown"))
                .binding(c.cooldownSeconds, () -> c.cooldownSeconds, value -> c.cooldownSeconds = value)
                .controller(option -> IntegerSliderControllerBuilder.create(option).range(0, 60).step(1))
                .build();

        return YetAnotherConfigLib.createBuilder()
                .title(Component.translatable("config.auto_command.title"))
                .category(ConfigCategory.createBuilder()
                        .name(Component.translatable("config.auto_command.category.feed"))
                        .option(feedEnabled)
                        .option(hunger)
                        .option(feedCommand)
                        .build())
                .category(ConfigCategory.createBuilder()
                        .name(Component.translatable("config.auto_command.category.heal"))
                        .option(healEnabled)
                        .option(health)
                        .option(healCommand)
                        .build())
                .category(ConfigCategory.createBuilder()
                        .name(Component.translatable("config.auto_command.category.fix"))
                        .option(fixEnabled)
                        .option(durability)
                        .option(fixCommand)
                        .build())
                .category(ConfigCategory.createBuilder()
                        .name(Component.translatable("config.auto_command.category.general"))
                        .option(cooldown)
                        .build())
                .save(c::save)
                .build()
                .generateScreen(parent);
    }
}
