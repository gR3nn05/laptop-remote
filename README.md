# 🎮 Cyberpunk Remote Controller

A premium, secure, and ultra-smooth remote controller for your laptop, built with React Native and Python. Control your mouse, keyboard, media, and browser with a modern, high-tech interface.

## ✨ Features

- **🖱️ Ultra-Smooth Trackpad**: Uses high-performance UDP communication for lag-free mouse control (120fps target), with automatic HTTP fallback.
- **⌨️ Live Keyboard**: Type on your phone and see it appear instantly on your laptop. Includes special keys like Backspace and Enter.
- **🌐 Browser Navigation**: Dedicated Back and Forward buttons for seamless web browsing.
- **🎵 Media & Volume**: Full control over Play/Pause, Next/Prev, and Volume/Mute.
- **🔒 Secure Pairing**: End-to-end encryption using AES-256-CBC and HMAC-SHA256. Requires a unique 6-digit pairing code for every session.
- **🎨 Modern UI**: A stunning "Cyberpunk" dark theme with neon accents and glassmorphism effects.

## 🛠️ Prerequisites

### Server (Laptop)
- Python 3.7 or higher
- Windows, macOS, or Linux

### Client (Mobile)
- Node.js & npm
- React Native environment (Android Studio / Xcode)

## 🚀 Installation

### 1. Set up the Server

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### 2. Set up the App

1.  Navigate to the app directory:
    ```bash
    cd mobile-app/RemoteController
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## 📱 Usage

1.  **Start the Server**:
    ```bash
    python server/main.py
    ```
    The server will print a **6-digit Pairing Code**. Keep this visible.

2.  **Run the App**:
    - **Android**:
        ```bash
        npx react-native run-android
        ```
    - **iOS**:
        ```bash
        npx react-native run-ios
        ```

3.  **Connect**:
    - Open the app.
    - Tap **SCAN** to automatically find your laptop on the Wi-Fi network.
    - Enter the **Pairing Code** shown on your laptop.
    - Tap **PAIR**.

4.  **Enjoy**: You now have full control!

## 🔧 Troubleshooting

-   **"No server found"**: Ensure both devices are on the **same Wi-Fi network**. Check your firewall settings to allow traffic on ports 5000 (TCP) and 55555 (UDP).
-   **"Security Error"**: The pairing code changes every time you restart the server. Make sure you enter the current code.
-   **"Connection Error"**: If the app disconnects, try scanning again.

## 📝 License

MIT License. Feel free to use and modify!
