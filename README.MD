# Laptop Remote

A simple, secure, and **cross-platform** app that turns your phone into a trackpad and keyboard for your laptop. I built this because I wanted a reliable way to control my computer (**macOS, Windows, or Linux**) from the couch without dealing with ads or subscription fees.

## What it does
It connects your phone to your laptop over Wi-Fi, giving you control over:
*   **Mouse**: Smooth trackpad movement with left/right clicks and scrolling.
*   **Keyboard**: Type remotely and use keys like Enter, Backspace, and Browser Navigation.
*   **Media**: Play/Pause, Volume control, and Track skipping.

## How it works
*   **The Server**: A lightweight Python script runs on your laptop (macOS/Windows/Linux).
*   **The App**: A React Native app on your phone (iOS/Android) sends commands securely.
*   **Security**: Everything is encrypted (AES-256), so no one else on your network can hijack your mouse.

## Getting Started

### 1. Run the Server (Laptop)
Works on macOS, Windows, and Linux. You'll need Python 3 installed.
```bash
cd server
pip install -r requirements.txt
python main.py
```
It will show you a **Pairing Code** and your **IP Address**.

### 2. Run the App (Phone)
First, install the project dependencies:
```bash
cd mobile-app/RemoteController
npm install
```

**iOS:**
1.  Install native pods:
    ```bash
    cd ios && pod install && cd ..
    ```
2.  Run on simulator or device:
    ```bash
    npx react-native run-ios
    ```
    *(Or open `ios/RemoteController.xcworkspace` in Xcode)*

**Android:**
1.  Start an emulator or connect your device.
2.  Run the app:
    ```bash
    npx react-native run-android
    ```

### 3. Connect
Open the app, enter the **Pairing Code**, and hit **Pair**.
*   The app tries to find your laptop automatically.
*   If it can't (e.g., due to firewall/network settings), just enter the IP address manually.

## Tech Stack & Learnings
Built with **Python** and **React Native**.
*   **Networking**: Uses UDP for fast mouse movement and HTTP for reliable typing/media commands.
*   **iOS Challenges**: Implemented a custom subnet scanner to find the server without needing complex Apple permissions (Multicast entitlements).
*   **Security**: Implemented a custom handshake with HMAC authentication to keep it safe.

## License
MIT License. Feel free to fork it and make it your own!
