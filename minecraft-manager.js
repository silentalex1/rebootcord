const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const PROJECTS_DIR = path.join(__dirname, 'projects_data');
const MINECRAFT_DIR = path.join(PROJECTS_DIR, 'minecraft');

class MinecraftManager {
  constructor() {
    this.servers = new Map();
    this.loadServers();
  }

  loadServers() {
    if (!fs.existsSync(MINECRAFT_DIR)) {
      fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
      return;
    }

    const serverDirs = fs.readdirSync(MINECRAFT_DIR);
    serverDirs.forEach(serverId => {
      const configPath = path.join(MINECRAFT_DIR, serverId, 'server-config.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          this.servers.set(serverId, config);
        } catch (error) {
          console.error(`Failed to load server ${serverId}:`, error);
        }
      }
    });
  }

  createServer(options) {
    const { version, ip, serverType } = options;
    const serverId = 'mc-' + crypto.randomBytes(8).toString('hex');
    const serverDir = path.join(MINECRAFT_DIR, serverId);
    
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    const serverConfig = {
      id: serverId,
      version: version,
      ip: ip,
      serverType: serverType,
      port: this.getNextPort(),
      status: 'creating',
      createdAt: new Date().toISOString(),
      createdBy: 'client-mod',
      hosting: '24/7-cloud'
    };

    const configPath = path.join(serverDir, 'server-config.json');
    fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 2));

    this.servers.set(serverId, serverConfig);
    return serverConfig;
  }

  getNextPort() {
    let maxPort = 25565;
    this.servers.forEach(config => {
      if (config.port && config.port > maxPort) {
        maxPort = config.port;
      }
    });
    return maxPort + 1;
  }

  startServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return { success: false, message: 'Server not found' };

    const serverDir = path.join(MINECRAFT_DIR, serverId);
    const composePath = path.join(serverDir, 'docker-compose.yml');

    if (!fs.existsSync(composePath)) {
      this.generateDockerCompose(server, serverDir);
    }

    return new Promise((resolve) => {
      exec(`cd ${serverDir} && docker-compose up -d`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Docker error for ${serverId}:`, error);
          server.status = 'failed';
          server.error = error.message;
          this.updateServerConfig(serverId, server);
          resolve({ success: false, message: error.message });
        } else {
          server.status = 'running';
          this.updateServerConfig(serverId, server);
          resolve({ success: true, message: 'Server started' });
        }
      });
    });
  }

  stopServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return { success: false, message: 'Server not found' };

    const serverDir = path.join(MINECRAFT_DIR, serverId);

    return new Promise((resolve) => {
      exec(`cd ${serverDir} && docker-compose down`, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, message: error.message });
        } else {
          server.status = 'stopped';
          this.updateServerConfig(serverId, server);
          resolve({ success: true, message: 'Server stopped' });
        }
      });
    });
  }

  generateDockerCompose(server, serverDir) {
    const compose = `version: '3.8'
services:
  minecraft:
    image: itzg/minecraft-server:latest
    container_name: ${server.id}
    environment:
      EULA: "TRUE"
      TYPE: ${server.serverType.toLowerCase()}
      VERSION: ${server.version}
      SERVER_PORT: ${server.port}
      SERVER_NAME: "Reboot Cord Server"
      MOTD: "Hosted by Reboot Cord"
      MAX_PLAYERS: 20
      ALLOW_NETHER: "true"
      ENABLE_RCON: "true"
      RCON_PORT: 25575
      RCON_PASSWORD: "rebootcord"
    ports:
      - "${server.port}:${server.port}"
      - "25575:25575"
    volumes:
      - ${serverDir}/data:/data
    restart: unless-stopped`;

    fs.writeFileSync(path.join(serverDir, 'docker-compose.yml'), compose);
  }

  updateServerConfig(serverId, config) {
    const serverDir = path.join(MINECRAFT_DIR, serverId);
    const configPath = path.join(serverDir, 'server-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    this.servers.set(serverId, config);
  }

  getServerStatus(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return { success: false, message: 'Server not found' };

    return {
      success: true,
      status: server.status,
      config: server
    };
  }

  getAllServers() {
    return Array.from(this.servers.values());
  }
}

module.exports = MinecraftManager;
