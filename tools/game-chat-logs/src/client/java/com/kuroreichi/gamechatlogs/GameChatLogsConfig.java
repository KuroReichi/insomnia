package com.kuroreichi.gamechatlogs;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonIOException;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

public final class GameChatLogsConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = Path.of("config", "game-chat-logs.json");

    public boolean enabled = true;
    public boolean includeGameMessages = true;
    public boolean githubSync = false;
    public String githubOwner = "";
    public String githubRepository = "";
    public String githubBranch = "main";
    public String githubToken = "";
    public String storageMode = "external";

    public static GameChatLogsConfig load() {
        try {
            if (Files.notExists(PATH)) return new GameChatLogsConfig();
            try (Reader reader = Files.newBufferedReader(PATH)) {
                GameChatLogsConfig config = GSON.fromJson(reader, GameChatLogsConfig.class);
                return config == null ? new GameChatLogsConfig() : config;
            }
        } catch (Exception ignored) {
            return new GameChatLogsConfig();
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
