package com.kuroreichi.gamechatlogs;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mojang.authlib.GameProfile;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.network.chat.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Environment(EnvType.CLIENT)
public final class GameChatLogsClient implements ClientModInitializer {
    public static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    public static GameChatLogsConfig CONFIG;
    private static final ExecutorService IO = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "game-chat-logs-io");
        thread.setDaemon(true);
        return thread;
    });

    private static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd-HH-mm-ss")
            .withZone(ZoneId.systemDefault());
    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ISO_OFFSET_DATE_TIME.withZone(ZoneId.systemDefault());
    private static Session session;

    @Override
    public void onInitializeClient() {
        CONFIG = GameChatLogsConfig.load();
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> startSession(client));
        ClientReceiveMessageEvents.CHAT.register((message, signedMessage, sender, params, timestamp) -> {
            if (CONFIG.enabled) recordChat(message, sender, timestamp);
        });
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
            if (CONFIG.enabled && CONFIG.includeGameMessages) recordGame(message, overlay, Instant.now());
        });
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> finishSession());
    }

    private static void startSession(Minecraft client) {
        if (!CONFIG.enabled) return;
        finishSession();
        ServerData server = client.getCurrentServer();
        String address = server == null || server.ip == null || server.ip.isBlank() ? "unknown-server" : server.ip;
        String playerName = client.player == null ? "unknown" : client.player.getName().getString();
        UUID uuid = client.player == null ? null : client.player.getUUID();
        Path root = resolveStorageRoot();
        Path serverDir = root.resolve(sanitize(address));
        session = new Session(address, extractPort(address), playerName, uuid, serverDir, Instant.now());
        Session current = session;
        CompletableFuture.runAsync(() -> {
            try {
                Files.createDirectories(serverDir.resolve("latest"));
                Files.writeString(serverDir.resolve("latest").resolve("log.txt"), header(current), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
                writeJson(current);
            } catch (IOException ignored) {
            }
        }, IO);
    }

    private static void recordChat(Component message, GameProfile sender, Instant timestamp) {
        Session current = session;
        if (current == null) return;
        String senderName = sender == null ? "unknown" : sender.name();
        append(current, "chat", senderName, message.getString(), false, timestamp);
    }

    private static void recordGame(Component message, boolean overlay, Instant timestamp) {
        Session current = session;
        if (current == null) return;
        append(current, "game", "server", message.getString(), overlay, timestamp);
    }

    private static void append(Session current, String type, String sender, String message, boolean overlay, Instant timestamp) {
        synchronized (current) {
            current.messages.add(new Entry(timestamp, type, sender, message, overlay));
            current.lastUpdated = Instant.now();
        }
        CompletableFuture.runAsync(() -> {
            try {
                Files.createDirectories(current.serverDir.resolve("latest"));
                Files.writeString(current.serverDir.resolve("latest").resolve("log.txt"),
                        line(timestamp, type, sender, message, overlay), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.WRITE);
                writeJson(current);
            } catch (IOException ignored) {
            }
        }, IO);
    }

    private static void finishSession() {
        Session current = session;
        session = null;
        if (current == null) return;
        CompletableFuture.runAsync(() -> {
            synchronized (current) {
                current.lastUpdated = Instant.now();
            }
            try {
                Files.createDirectories(current.serverDir);
                String historyName = "history-" + FILE_TIME.format(current.startedAt) + ".log";
                Path latestTxt = current.serverDir.resolve("latest").resolve("log.txt");
                if (Files.exists(latestTxt)) {
                    Files.copy(latestTxt, current.serverDir.resolve(historyName), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                writeJson(current);
                if (CONFIG.githubSync && !CONFIG.githubOwner.isBlank() && !CONFIG.githubRepository.isBlank() && !CONFIG.githubToken.isBlank()) {
                    GitHubSync.upload(current);
                }
            } catch (IOException ignored) {
            }
        }, IO);
    }

    static Path resolveStorageRoot() {
        Path instanceRoot = Minecraft.getInstance().gameDirectory.toPath();
        if ("instance".equalsIgnoreCase(CONFIG.storageMode)) return instanceRoot.resolve(".kuro.chatlogs");
        Path external = Path.of("/storage/emulated/0/@kuro.chatlogs");
        try {
            Files.createDirectories(external);
            return external;
        } catch (IOException ignored) {
            Path fallback = instanceRoot.resolve("@kuro.chatlogs");
            try { Files.createDirectories(fallback); } catch (IOException ignoredAgain) { }
            return fallback;
        }
    }

    private static String header(Session s) {
        return "Game Chat Logs\nServer: " + s.address + "\nSession started: " + DISPLAY_TIME.format(s.startedAt) + "\nPlayer: " + s.playerName + "\n\n";
    }

    private static String line(Instant timestamp, String type, String sender, String message, boolean overlay) {
        String clean = message.replace("\r", "").replace("\n", "\\n");
        return "[" + DISPLAY_TIME.format(timestamp) + "] [" + type + (overlay ? ":overlay" : "") + "] <" + sender + "> " + clean + System.lineSeparator();
    }

    private static void writeJson(Session s) throws IOException {
        JsonObject root = new JsonObject();
        root.addProperty("schema_version", 1);
        JsonObject server = new JsonObject();
        server.addProperty("address", s.address);
        server.addProperty("port", s.port);
        root.add("server", server);
        JsonObject sessionJson = new JsonObject();
        sessionJson.addProperty("started_at", s.startedAt.toString());
        sessionJson.addProperty("last_updated", s.lastUpdated.toString());
        root.add("session", sessionJson);
        JsonObject player = new JsonObject();
        player.addProperty("name", s.playerName);
        if (s.playerUuid != null) player.addProperty("uuid", s.playerUuid.toString());
        root.add("player", player);
        JsonArray messages = new JsonArray();
        synchronized (s) {
            for (Entry entry : s.messages) {
                JsonObject item = new JsonObject();
                item.addProperty("timestamp", entry.timestamp.toString());
                item.addProperty("type", entry.type);
                item.addProperty("sender", entry.sender);
                item.addProperty("message", entry.message);
                item.addProperty("overlay", entry.overlay);
                messages.add(item);
            }
        }
        root.add("messages", messages);
        Files.createDirectories(s.serverDir.resolve("latest"));
        Files.writeString(s.serverDir.resolve("latest").resolve("log.json"), GSON.toJson(root), StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
    }

    private static int extractPort(String address) {
        int colon = address.lastIndexOf(':');
        if (colon > -1 && colon < address.length() - 1) {
            try { return Integer.parseInt(address.substring(colon + 1)); } catch (NumberFormatException ignored) { }
        }
        return 25565;
    }

    static String sanitize(String value) {
        String sanitized = value.replaceAll("[^a-zA-Z0-9._-]", "_");
        return sanitized.isBlank() ? "unknown-server" : sanitized;
    }

    static final class Session {
        final String address;
        final int port;
        final String playerName;
        final UUID playerUuid;
        final Path serverDir;
        final Instant startedAt;
        volatile Instant lastUpdated;
        final List<Entry> messages = new ArrayList<>();
        Session(String address, int port, String playerName, UUID playerUuid, Path serverDir, Instant startedAt) {
            this.address = address;
            this.port = port;
            this.playerName = playerName;
            this.playerUuid = playerUuid;
            this.serverDir = serverDir;
            this.startedAt = startedAt;
            this.lastUpdated = startedAt;
        }
    }

    record Entry(Instant timestamp, String type, String sender, String message, boolean overlay) { }
}
