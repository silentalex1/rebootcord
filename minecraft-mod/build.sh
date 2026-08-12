#!/bin/bash

cd "$(dirname "$0")"

if [ ! -f "gradlew" ]; then
    echo "Setting up Gradle wrapper..."
    gradle wrapper --gradle-version 8.5
fi

echo "Building Reboot Cord Fabric mod..."
./gradlew build

if [ -f "build/libs/*.jar" ]; then
    echo "Build successful! JAR file created in build/libs/"
    cp build/libs/*.jar ../rebootcord-mod.jar
    echo "Copied mod to ../rebootcord-mod.jar"
else
    echo "Build failed!"
    exit 1
fi