# Trackpad and Volume Control Improvements

## New Features

### 1. Tap-to-Click Trackpad
The trackpad now supports natural tap-to-click functionality:
- **Quick Tap**: Tap the trackpad for less than 200ms with minimal movement (< 5px) to perform a left click
- **Drag to Move**: Drag your finger across the trackpad to move the cursor
- **Smart Detection**: The app intelligently distinguishes between taps and drags

### 2. Cross-Platform Volume Control
Volume controls now work on all major platforms:
- **Linux**: Uses PulseAudio (`pactl`) with ALSA (`amixer`) fallback
- **Windows**: Uses system media keys
- **macOS**: Uses system media keys

## Technical Details

### Mobile App Changes (App.tsx)
- Added gesture state tracking with `onHandlerStateChange`
- Implemented tap detection using timing (200ms) and movement (5px) thresholds
- Updated UI text to reflect new "Tap to click • Drag to move cursor" functionality
- Added movement detection to prevent accidental clicks during cursor movement

### Server Changes (main.py)
- Extended `handle_volume()` to support Windows and macOS
- Maintained backward compatibility with existing Linux volume control
- Uses media keys for Windows/macOS volume control
- Preserved PulseAudio/ALSA fallback system for Linux

## Usage
1. **Mobile App**: The trackpad area now supports both tapping and dragging
2. **Server**: Volume controls work automatically based on the detected operating system
3. **Backward Compatibility**: All existing functionality remains unchanged