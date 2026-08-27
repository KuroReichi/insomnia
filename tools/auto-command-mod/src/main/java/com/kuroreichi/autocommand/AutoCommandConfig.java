package com.kuroreichi.autocommand;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class AutoCommandConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("auto_command.json");

    public boolean autoFeed = true;
    public int hungerThreshold = 10;
    public String feedCommand = "/feed";

    public boolean autoHeal = true;
    public float healthThreshold = 8.0f;
    public String healCommand = "/heal";

    public boolean autoFix = true;
    public int durabilityThresholdPercent = 20;
    public String fixCommand = "/fix";

    public int cooldownSeconds = 3;

    public static AutoCommandConfig load() {
        if (Files.exists(PATH)) {
            try {
                AutoCommandConfig config = GSON.fromJson(Files.readString(PATH), AutoCommandConfig.class);
                if (config != null) {
                    config.clampValues();
                    return config;
                }
            } catch (Exception ignored) {
                // Fall back to defaults when the config cannot be parsed.
            }
        }

        AutoCommandConfig config = new AutoCommandConfig();
        config.save();
        return config;
    }

    public void clampValues() {
        hungerThreshold = Math.max(0, Math.min(20, hungerThreshold));
        healthThreshold = Math.max(0.0f, Math.min(40.0f, healthThreshold));
        durabilityThresholdPercent = Math.max(0, Math.min(100, durabilityThresholdPercent));
        cooldownSeconds = Math.max(0, Math.min(60, cooldownSeconds));

        if (feedCommand == null) feedCommand = "/feed";
        if (healCommand == null) healCommand = "/heal";
        if (fixCommand == null) fixCommand = "/fix";
    }

    public void save() {
        clampValues();
        try {
            Files.createDirectories(PATH.getParent());
            Files.writeString(PATH, GSON.toJson(this));
        } catch (IOException ignored) {
            // A failed config save should not crash the client.
        }
    }
}
