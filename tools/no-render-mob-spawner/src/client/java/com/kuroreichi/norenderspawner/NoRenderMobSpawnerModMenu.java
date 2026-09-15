package com.kuroreichi.norenderspawner;

import com.terraformersmc.modmenu.api.ConfigScreenFactory;
import com.terraformersmc.modmenu.api.ModMenuApi;

public final class NoRenderMobSpawnerModMenu implements ModMenuApi {
    @Override
    public ConfigScreenFactory<?> getModConfigScreenFactory() {
        return NoRenderMobSpawnerConfigScreen::new;
    }
}
