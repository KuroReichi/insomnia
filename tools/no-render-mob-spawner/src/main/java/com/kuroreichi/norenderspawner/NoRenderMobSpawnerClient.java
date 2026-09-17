package com.kuroreichi.norenderspawner;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.model.loading.v1.ModelLoadingPlugin;

public final class NoRenderMobSpawnerClient implements ClientModInitializer {
    public static final NoRenderMobSpawnerConfig CONFIG = NoRenderMobSpawnerConfig.load();

    @Override
    public void onInitializeClient() {
        ModelLoadingPlugin.register(new NoRenderMobSpawnerModelPlugin());
    }
}
