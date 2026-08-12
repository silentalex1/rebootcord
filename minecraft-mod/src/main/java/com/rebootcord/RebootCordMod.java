package com.rebootcord;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public class RebootCordMod implements ClientModInitializer {
    private static RebootCordMod instance;
    private MinecraftClient client;
    private HostingScreen hostingScreen;
    private boolean showHostingUI = false;

    @Override
    public void onInitializeClient() {
        instance = this;
        ClientTickEvents.END_CLIENT_TICK.register(this::onTick);
        HudRenderCallback.EVENT.register(this::onRender);
    }

    private void onTick(MinecraftClient client) {
        this.client = client;
        
        if (client.options.useKey.wasPressed() && hasControlDown()) {
            showHostingUI = !showHostingUI;
            if (showHostingUI) {
                hostingScreen = new HostingScreen();
                client.setScreen(hostingScreen);
            } else {
                client.setScreen(null);
            }
        }
    }

    private void onRender(DrawContext context, float tickDelta) {
        if (showHostingUI && client.screen == null) {
            hostingScreen = new HostingScreen();
            client.setScreen(hostingScreen);
        }
    }

    private boolean hasControlDown() {
        return GLFW.glfwGetKey(GLFW.glfwGetCurrentContext(), GLFW.GLFW_KEY_LEFT_CONTROL) == GLFW.GLFW_PRESS ||
               GLFW.glfwGetKey(GLFW.glfwGetCurrentContext(), GLFW.GLFW_KEY_RIGHT_CONTROL) == GLFW.GLFW_PRESS;
    }

    public static RebootCordMod getInstance() {
        return instance;
    }

    public MinecraftClient getClient() {
        return client;
    }
}