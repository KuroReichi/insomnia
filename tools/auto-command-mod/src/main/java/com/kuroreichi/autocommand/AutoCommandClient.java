package com.kuroreichi.autocommand;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.item.ItemStack;

public final class AutoCommandClient implements ClientModInitializer {
    public static final String MOD_ID = "auto_command";
    public static final AutoCommandConfig CONFIG = AutoCommandConfig.load();

    private boolean feedArmed = true;
    private boolean healArmed = true;
    private boolean fixArmed = true;
    private int cooldownTicks = 0;

    @Override
    public void onInitializeClient() {
        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
    }

    private void onClientTick(Minecraft client) {
        if (cooldownTicks > 0) {
            cooldownTicks--;
        }

        LocalPlayer player = client.player;
        if (player == null || client.level == null) {
            feedArmed = true;
            healArmed = true;
            fixArmed = true;
            return;
        }

        CONFIG.clampValues();

        boolean hungerLow = CONFIG.autoFeed && player.getFoodData().getFoodLevel() <= CONFIG.hungerThreshold;
        boolean healthLow = CONFIG.autoHeal && player.getHealth() <= CONFIG.healthThreshold;
        boolean durabilityLow = CONFIG.autoFix && isMainHandDurabilityLow(player.getMainHandItem(), CONFIG.durabilityThresholdPercent);

        if (!hungerLow) {
            feedArmed = true;
        }
        if (!healthLow) {
            healArmed = true;
        }
        if (!durabilityLow) {
            fixArmed = true;
        }

        if (cooldownTicks > 0) {
            return;
        }

        if (hungerLow && feedArmed && executeCommand(player, CONFIG.feedCommand)) {
            feedArmed = false;
            startCooldown();
            return;
        }

        if (healthLow && healArmed && executeCommand(player, CONFIG.healCommand)) {
            healArmed = false;
            startCooldown();
            return;
        }

        if (durabilityLow && fixArmed && executeCommand(player, CONFIG.fixCommand)) {
            fixArmed = false;
            startCooldown();
        }
    }

    private void startCooldown() {
        cooldownTicks = CONFIG.cooldownSeconds * 20;
    }

    private static boolean executeCommand(LocalPlayer player, String command) {
        String normalized = command == null ? "" : command.trim();
        if (normalized.isEmpty()) {
            return false;
        }

        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.isBlank()) {
            return false;
        }

        player.connection.sendCommand(normalized);
        return true;
    }

    private static boolean isMainHandDurabilityLow(ItemStack stack, int thresholdPercent) {
        int maxDamage = stack.getMaxDamage();
        if (maxDamage <= 0) {
            return false;
        }

        int remaining = Math.max(0, maxDamage - stack.getDamageValue());
        int percent = Math.round(remaining * 100.0f / maxDamage);
        return percent <= thresholdPercent;
    }
}
