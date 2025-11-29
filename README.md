# Laptop Remote Controller

A secure, cross-platform remote control application that allows you to control your laptop's mouse, keyboard, and media functions from your mobile device.

## Features

- **Secure Communication**: End-to-end encryption using AES-256 and HMAC authentication.
- **Trackpad Control**: Low-latency mouse movement using UDP with HTTP fallback.
- **Keyboard Input**: Live text input and special key support (Backspace, Enter, Browser Navigation).
- **Media Controls**: Play/Pause, Previous/Next track, and Volume control.
- **Cross-Platform**: Server runs on Python (Windows/Linux/macOS), Client runs on React Native (Android/iOS).

## Prerequisites

- **Server**: Python 3.7 or higher.
- **Client**: Node.js, npm, and a React Native development environment (Android Studio or Xcode).

## Installation

### Server

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

### Mobile App

1. Navigate to the app directory:
   ```bash
   cd mobile-app/RemoteController
   ```
2. Install the JavaScript dependencies:
   ```bash
   npm install
   ```

## Usage

1. **Start the Server**:
   Run the Python server on your laptop. It will display a 6-digit pairing code.
   ```bash
   python server/main.py
   ```

2. **Run the App**:
   Launch the application on your mobile device or emulator.
   - Android: `npx react-native run-android`
   - iOS: `npx react-native run-ios`

3. **Connect**:
   - Tap "Scan Network" to automatically detect the server.
   - Enter the 6-digit pairing code displayed on the server.
   - Tap "Connect & Pair".

## Network Configuration

Ensure both devices are connected to the same Wi-Fi network. You may need to allow traffic on ports 5000 (TCP) and 55555 (UDP) through your firewall.

## License

This project is open source and available under the MIT License.
