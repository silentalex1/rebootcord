#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/setup-vps.sh"
  exit 1
fi

MC_PORT_MIN=25565
MC_PORT_MAX=25864
APP_PORT=1000
INSTALL_DIR="/opt/rebootcord"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

apt-get update -qq
apt-get install -y curl rsync ufw fail2ban unattended-upgrades openjdk-21-jre-headless

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

cat > /etc/sysctl.d/99-rebootcord.conf <<EOF
vm.swappiness=10
vm.max_map_count=262144
net.core.somaxconn=4096
net.ipv4.tcp_fin_timeout=15
net.ipv4.ip_local_port_range=1024 65535
fs.file-max=200000
EOF
sysctl --system

if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

id -u rebootcord &>/dev/null || useradd -r -m -d "$INSTALL_DIR" -s /usr/sbin/nologin rebootcord

cat > /etc/security/limits.d/rebootcord.conf <<EOF
rebootcord soft nofile 65536
rebootcord hard nofile 65536
rebootcord soft nproc 8192
rebootcord hard nproc 8192
EOF

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow ${APP_PORT}/tcp
ufw allow ${MC_PORT_MIN}:${MC_PORT_MAX}/tcp
ufw allow ${MC_PORT_MIN}:${MC_PORT_MAX}/udp
ufw --force enable

systemctl enable fail2ban
systemctl restart fail2ban

mkdir -p "$INSTALL_DIR"
rsync -a --exclude node_modules --exclude data --exclude projects_data "$REPO_DIR"/ "$INSTALL_DIR"/
chown -R rebootcord:rebootcord "$INSTALL_DIR"

cd "$INSTALL_DIR"
sudo -u rebootcord npm install --production

cp deploy/rebootcord.service /etc/systemd/system/rebootcord.service
systemctl daemon-reload
systemctl enable rebootcord
systemctl restart rebootcord

echo "Reboot Cord installed at $INSTALL_DIR and running as a systemd service."
echo "Web port: ${APP_PORT}, Minecraft port range: ${MC_PORT_MIN}-${MC_PORT_MAX}"
echo "Status: systemctl status rebootcord"
echo "Logs:   journalctl -u rebootcord -f"
