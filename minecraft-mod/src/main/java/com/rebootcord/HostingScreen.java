package com.rebootcord;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import java.awt.Color;

public class HostingScreen extends Screen {
    private TextFieldWidget versionField;
    private TextFieldWidget ipField;
    private ButtonWidget serverTypeDropdown;
    private ButtonWidget createServerButton;
    private String selectedServerType = "Vanilla";
    private boolean showServerForm = false;
    private final String[] serverTypes = {"Vanilla", "Paper", "Fabric", "Forge", "Bukkit"};
    private int serverTypeIndex = 0;

    public HostingScreen() {
        super(Text.of("Reboot Cord Hosting"));
    }

    @Override
    protected void init() {
        super.init();
        
        if (!showServerForm) {
            int buttonWidth = 200;
            int buttonHeight = 25;
            int centerX = this.width / 2;
            int centerY = this.height / 2;
            
            ButtonWidget startHostingButton = ButtonWidget.builder(Text.of("Start Hosting"), button -> {
                pingWebsite();
            })
                .dimensions(centerX - buttonWidth / 2, centerY - 20, buttonWidth, buttonHeight)
                .build();
            
            this.addDrawableChild(startHostingButton);
        } else {
            int centerX = this.width / 2;
            int startY = this.height / 2 - 50;
            
            versionField = new TextFieldWidget(this.textRenderer, centerX - 100, startY, 200, 20, Text.of("Minecraft Version"));
            versionField.setPlaceholder(Text.of("Type any minecraft version"));
            versionField.setMaxLength(10);
            versionField.setText("1.20.4");
            
            ipField = new TextFieldWidget(this.textRenderer, centerX - 100, startY + 40, 200, 20, Text.of("Server IP"));
            ipField.setPlaceholder(Text.of("Enter an minecraft ip"));
            ipField.setMaxLength(50);
            ipField.setText("play.rebootcord.world");
            
            serverTypeDropdown = ButtonWidget.builder(Text.of("Server Type: " + selectedServerType), button -> {
                serverTypeIndex = (serverTypeIndex + 1) % serverTypes.length;
                selectedServerType = serverTypes[serverTypeIndex];
                button.setMessage(Text.of("Server Type: " + selectedServerType));
            })
                .dimensions(centerX - 100, startY + 80, 200, 20)
                .build();
            
            createServerButton = ButtonWidget.builder(Text.of("Create Server"), button -> {
                createServer();
            })
                .dimensions(centerX - 100, startY + 120, 200, 25)
                .build();
            
            this.addDrawableChild(versionField);
            this.addDrawableChild(ipField);
            this.addDrawableChild(serverTypeDropdown);
            this.addDrawableChild(createServerButton);
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        
        int centerX = this.width / 2;
        int centerY = this.height / 2;
        
        if (!showServerForm) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.of("Start Hosting"), centerX, centerY - 50, 0xFFFFFF);
            context.drawCenteredTextWithShadow(this.textRenderer, Text.of("Click 'Start Hosting' and make sure your in the main site of the website."), centerX, centerY + 20, 0xAAAAAA);
        } else {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.of("Type any minecraft version"), centerX, centerY - 70, 0xFFFFFF);
            context.drawCenteredTextWithShadow(this.textRenderer, Text.of("Enter an minecraft ip"), centerX, centerY - 30, 0xFFFFFF);
        }
        
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean charTyped(char chr, int modifiers) {
        if (showServerForm) {
            if (versionField.charTyped(chr, modifiers)) return true;
            if (ipField.charTyped(chr, modifiers)) return true;
        }
        return super.charTyped(chr, modifiers);
    }

    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (showServerForm) {
            if (versionField.keyPressed(keyCode, scanCode, modifiers)) return true;
            if (ipField.keyPressed(keyCode, scanCode, modifiers)) return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    private void pingWebsite() {
        new Thread(() -> {
            try {
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) 
                    new java.net.URL("https://rebootcord.world/dashboard").openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.connect();
                
                if (connection.getResponseCode() == 200) {
                    showServerForm = true;
                    MinecraftClient.getInstance().execute(() -> {
                        this.clear();
                        this.init();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void createServer() {
        String version = versionField.getText().trim();
        String ip = ipField.getText().trim();
        
        if (!isValidVersion(version)) {
            MinecraftClient.getInstance().player.sendMessage(Text.of("§cThat is NOT the correct minecraft version.."), true);
            return;
        }
        
        new Thread(() -> {
            try {
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) 
                    new java.net.URL("https://rebootcord.world/api/minecraft/create").openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                
                String jsonInputString = String.format(
                    "{\"version\":\"%s\",\"ip\":\"%s\",\"serverType\":\"%s\"}",
                    version, ip, selectedServerType
                );
                
                try (java.io.OutputStream os = connection.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                
                connection.connect();
                
                if (connection.getResponseCode() == 200) {
                    MinecraftClient.getInstance().execute(() -> {
                        MinecraftClient.getInstance().player.sendMessage(Text.of("§aServer created successfully!"), true);
                        MinecraftClient.getInstance().setScreen(null);
                    });
                } else {
                    MinecraftClient.getInstance().execute(() -> {
                        MinecraftClient.getInstance().player.sendMessage(Text.of("§cFailed to create server."), true);
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                MinecraftClient.getInstance().execute(() -> {
                    MinecraftClient.getInstance().player.sendMessage(Text.of("§cConnection error."), true);
                });
            }
        }).start();
    }

    private boolean isValidVersion(String version) {
        return version.matches("1\\.(\\d+)(\\.(\\d+))?");
    }
}