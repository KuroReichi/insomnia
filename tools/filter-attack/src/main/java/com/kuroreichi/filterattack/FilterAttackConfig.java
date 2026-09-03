package com.kuroreichi.filterattack;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class FilterAttackConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("filter-attack.json");

    public boolean enabled = true;
    public List<String> blockedEntities = new ArrayList<>();

    public static FilterAttackConfig load() {
        try {
            if (Files.exists(PATH)) {
                try (Reader reader = Files.newBufferedReader(PATH)) {
                    FilterAttackConfig config = GSON.fromJson(reader, FilterAttackConfig.class);
                    if (config != null) {
                        config.normalize();
                        return config;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        FilterAttackConfig config = new FilterAttackConfig();
        config.normalize();
        return config;
    }

    public void save() {
        normalize();
        try {
            Files.createDirectories(PATH.getParent());
            try (Writer writer = Files.newBufferedWriter(PATH)) {
                GSON.toJson(this, writer);
            }
        } catch (IOException ignored) {
        }
    }

    public boolean isBlocked(String id) {
        return enabled && blockedEntities.contains(id);
    }

    public void normalize() {
        Set<String> normalized = new LinkedHashSet<>();
        if (blockedEntities != null) {
            for (String raw : blockedEntities) {
                if (raw == null) continue;
                String id = raw.trim().toLowerCase();
                if (id.isEmpty()) continue;
                normalized.add(id);
            }
        }
        blockedEntities = new ArrayList<>(normalized);
    }

    public void setBlockedFromText(String text) {
        List<String> result = new ArrayList<>();
        if (text != null) {
            for (String line : text.split("[\\r\\n,]+")) {
                String id = line.trim().toLowerCase();
                if (!id.isEmpty()) result.add(id);
            }
        }
        blockedEntities = result;
        normalize();
    }

    public String getBlockedText() {
        return String.join("\\n", blockedEntities);
    }
}
