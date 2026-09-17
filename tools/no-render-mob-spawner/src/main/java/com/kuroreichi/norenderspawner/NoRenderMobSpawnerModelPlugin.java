package com.kuroreichi.norenderspawner;

import java.util.List;
import java.util.function.Predicate;
import net.fabricmc.fabric.api.client.model.loading.v1.ModelLoadingPlugin;
import net.fabricmc.fabric.api.client.model.loading.v1.wrapper.WrapperBlockStateModel;
import net.fabricmc.fabric.api.client.renderer.v1.mesh.QuadEmitter;
import net.minecraft.client.renderer.block.BlockAndTintGetter;
import net.minecraft.client.renderer.block.dispatch.BlockStateModel;
import net.minecraft.client.renderer.block.dispatch.BlockStateModelPart;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

public final class NoRenderMobSpawnerModelPlugin implements ModelLoadingPlugin {
    @Override
    public void initialize(Context context) {
        context.modifyBlockModelAfterBake().register((model, modelContext) -> {
            if (modelContext.state().is(Blocks.SPAWNER)) {
                return new SpawnerModelWrapper(model);
            }
            return model;
        });
    }

    private static final class SpawnerModelWrapper extends WrapperBlockStateModel {
        private SpawnerModelWrapper(BlockStateModel wrapped) {
            super(wrapped);
        }

        @Override
        public void collectParts(RandomSource random, List<BlockStateModelPart> parts) {
            if (NoRenderMobSpawnerClient.CONFIG.enabled
                    && NoRenderMobSpawnerClient.CONFIG.hideSpawnerBlock) {
                return;
            }
            super.collectParts(random, parts);
        }

        @Override
        public void emitQuads(
                QuadEmitter emitter,
                BlockAndTintGetter level,
                BlockPos pos,
                BlockState state,
                RandomSource random,
                Predicate<Direction> cullTest
        ) {
            if (NoRenderMobSpawnerClient.CONFIG.enabled
                    && NoRenderMobSpawnerClient.CONFIG.hideSpawnerBlock) {
                return;
            }
            super.emitQuads(emitter, level, pos, state, random, cullTest);
        }
    }
}
