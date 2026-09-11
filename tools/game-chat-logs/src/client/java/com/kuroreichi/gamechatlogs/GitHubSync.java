package com.kuroreichi.gamechatlogs;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

final class GitHubSync {
    private GitHubSync() { }

    static void upload(GameChatLogsClient.Session session) {
        try {
            Path history = session.serverDir.resolve("history-" + java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd-HH-mm-ss").withZone(java.time.ZoneId.systemDefault()).format(session.startedAt) + ".log");
            if (Files.notExists(history)) return;

            String owner = GameChatLogsClient.CONFIG.githubOwner.trim();
            String repo = GameChatLogsClient.CONFIG.githubRepository.trim();
            String branch = GameChatLogsClient.CONFIG.githubBranch.trim().isBlank() ? "main" : GameChatLogsClient.CONFIG.githubBranch.trim();
            String remotePath = "chatlogs/" + GameChatLogsClient.sanitize(session.address) + "/" + history.getFileName();
            String api = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + encodePath(remotePath);

            HttpClient client = HttpClient.newHttpClient();
            byte[] bytes = Files.readAllBytes(history);
            JsonObject body = new JsonObject();
            body.addProperty("message", "logs: " + history.getFileName());
            body.addProperty("content", Base64.getEncoder().encodeToString(bytes));
            body.addProperty("branch", branch);

            HttpRequest request = HttpRequest.newBuilder(URI.create(api))
                    .header("Authorization", "Bearer " + GameChatLogsClient.CONFIG.githubToken.trim())
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 200 && response.statusCode() < 300) return;
            if (response.statusCode() != 409) return;

            String get = URI.create(api + "?ref=" + branch).toString();
            HttpRequest getRequest = HttpRequest.newBuilder(URI.create(get))
                    .header("Authorization", "Bearer " + GameChatLogsClient.CONFIG.githubToken.trim())
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .GET().build();
            HttpResponse<String> getResponse = client.send(getRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (getResponse.statusCode() < 200 || getResponse.statusCode() >= 300) return;
            JsonObject existing = JsonParser.parseString(getResponse.body()).getAsJsonObject();
            body.addProperty("sha", existing.get("sha").getAsString());
            HttpRequest updateRequest = HttpRequest.newBuilder(URI.create(api))
                    .header("Authorization", "Bearer " + GameChatLogsClient.CONFIG.githubToken.trim())
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                    .build();
            client.send(updateRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
    }

    private static String encodePath(String path) {
        return java.util.Arrays.stream(path.split("/"))
                .map(part -> java.net.URLEncoder.encode(part, StandardCharsets.UTF_8).replace("+", "%20"))
                .reduce((a, b) -> a + "/" + b).orElse("");
    }
}
