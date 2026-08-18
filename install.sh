#!/bin/bash

RED='\033[0;31m'
GRAY='\033[0;90m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear()

show_centered() {
    local text="$1"
    local color="$2"
    local term_width=$(tput cols)
    local text_length=${#text}
    local padding=$(( (term_width - text_length) / 2 ))
    printf "%${padding}s" ""
    echo -e "${color}${text}${NC}"
}

draw_loading_bar() {
    local percentage=$1
    local bar_width=50
    local filled=$((percentage * bar_width / 100))
    local empty=$((bar_width - filled))
    
    local term_width=$(tput cols)
    local bar_start=$(( (term_width - bar_width) / 2 ))
    
    printf "%${bar_start}s" ""
    echo -ne "["
    for ((i=0; i<filled; i++)); do
        echo -ne "${GREEN}█${NC}"
    done
    for ((i=0; i<empty; i++)); do
        echo -ne "░"
    done
    echo -ne "] ${percentage}%"
    echo ""
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
}

install_dependencies() {
    detect_os
    
    case $OS in
        "linux")
            if command -v apt-get &> /dev/null; then
                sudo apt-get update -qq
                sudo apt-get install -y openjdk-17-jdk curl wget unzip
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y java-17-openjdk curl wget unzip
            elif command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm jdk17-openjdk curl wget unzip
            fi
            ;;
        "macos")
            if ! command -v brew &> /dev/null; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install openjdk@17 curl wget unzip
            ;;
        "windows")
            echo "Windows detected. Please install Java 17 manually from https://adoptium.net/"
            ;;
    esac
}

install_fabric() {
    local install_dir="$HOME/.rebootcord"
    mkdir -p "$install_dir"
    
    curl -sL "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.0/fabric-installer-1.0.0.jar" -o "$install_dir/fabric-installer.jar"
    
    java -jar "$install_dir/fabric-installer.jar" client -dir "$install_dir/minecraft" -mcversion 1.20.4
    
    echo "$install_dir/minecraft" > "$install_dir/install_path.txt"
}

install_mod() {
    local install_dir="$HOME/.rebootcord"
    local mods_dir="$install_dir/minecraft/mods"
    mkdir -p "$mods_dir"
    
    curl -sL "https://rebootcord.world/downloads/rebootcord-mod.jar" -o "$mods_dir/rebootcord-mod.jar"
}

main() {
    clear
    
    for i in {1..3}; do
        show_centered "" ""
        sleep 0.1
    done
    
    show_centered "reboot" "$RED"
    show_centered "cord" "$GRAY"
    echo ""
    
    show_centered "Installing all reboot cord client mod dependencies..." "$YELLOW"
    echo ""
    
    for i in {1..3}; do
        echo ""
    done
    
    for progress in {0..100}; do
        clear
        
        for i in {1..3}; do
            show_centered "" ""
        done
        
        show_centered "reboot" "$RED"
        show_centered "cord" "$GRAY"
        echo ""
        
        show_centered "Installing all reboot cord client mod dependencies..." "$YELLOW"
        echo ""
        
        for i in {1..3}; do
            echo ""
        done
        
        draw_loading_bar $progress
        
        case $progress in
            10)
                install_dependencies &
                ;;
            30)
                install_fabric &
                ;;
            60)
                install_mod &
                ;;
            90)
                sleep 1
                ;;
        esac
        
        sleep 0.05
    done
    
    clear
    
    for i in {1..3}; do
        show_centered "" ""
    done
    
    show_centered "reboot" "$RED"
    show_centered "cord" "$GRAY"
    echo ""
    
    show_centered "Installation complete!" "$GREEN"
    show_centered "Next steps:" "$YELLOW"
    show_centered "1. Download mod from: https://rebootcord.world/downloads/rebootcord-mod.jar" "$GRAY"
    show_centered "2. Place in: ~/.rebootcord/minecraft/mods/" "$GRAY"
    show_centered "3. Launch Minecraft with Fabric profile" "$GRAY"
    echo ""
}

main