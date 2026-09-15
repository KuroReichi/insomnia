package com.kuroreichi.norenderspawner;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonIOException;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

public final class NoRenderMobSpawnerConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = Path.of("config", "no-render-mob-spawner.json");

    public boolean enabled = true;
    public boolean hideSpawnerBlock = true;
    public boolean hidePreviewAndEffects = true;
    public boolean optimizeBlockEntityUpdates = true;

    public static NoRenderMobSpawnerConfig load() {
        try {
            if (Files.notExists(PATH)) return new NoRenderMobSpawnerConfig();
            try (Reader reader = Files.newBufferedReader(PATH)) {
                NoRenderMobSpawnerConfig config = GSON.fromJson(reader, NoRenderMobSpawnerConfig.class);
                return config == null ? new NoRenderMobSpawnerConfig() : config;
            }
        } catch (Exception ignored) {
            return new NoRenderMobSpawnerConfig();
        }
    }

    public void save() {
        try {
            Path parent = PATH.getParent();
            if (parent != null) Files.createDirectories(parent);
            try (Writer writer = Files.newBufferedWriter(PATH)) {
                GSON.toJson(this, writer);
            }
        } catch (IOException | JsonIOException ignored) {
        }
    }
}
