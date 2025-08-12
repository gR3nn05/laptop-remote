import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';

const App = () => {
  const [serverIP, setServerIP] = useState('192.168.1.100');
  const [serverPort, setServerPort] = useState('5000');
  const [connected, setConnected] = useState(false);
  const [textToSend, setTextToSend] = useState('');
  
  // Trackpad smoothing variables
  const lastMoveTime = useRef(0);
  const lastPosition = useRef({ x: 0, y: 0 });

  const sendCommand = async (command: string, data?: any) => {
    try {
      const response = await fetch(`http://${serverIP}:${serverPort}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, data }),
      });
      
      if (response.ok) {
        console.log(`Command sent: ${command}`, data);
      } else {
        Alert.alert('Error', 'Failed to send command');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Cannot connect to laptop');
      setConnected(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await fetch(`http://${serverIP}:${serverPort}/ping`);
      if (response.ok) {
        setConnected(true);
        Alert.alert('Success', 'Connected to laptop!');
      }
    } catch (error) {
      setConnected(false);
      Alert.alert('Error', 'Cannot connect to laptop');
    }
  };

  const handleTrackpadGesture = (event: PanGestureHandlerGestureEvent) => {
    const { velocityX, velocityY, translationX, translationY } = event.nativeEvent;
    const now = Date.now();
    
    // Throttle to 60fps (16ms)
    if (now - lastMoveTime.current < 16) {
      return;
    }
    lastMoveTime.current = now;

    // Use velocity for smoother movement (scaled down)
    const sensitivity = 0.025; // Adjust this for speed (0.01 = slow, 0.05 = fast)
    const smoothX = velocityX * sensitivity;
    const smoothY = velocityY * sensitivity;

    // Only send movement if it's significant
    if (Math.abs(smoothX) > 0.05 || Math.abs(smoothY) > 0.05) {
      sendCommand('mouse_move_relative', {
        x: Math.round(smoothX),
        y: Math.round(smoothY)
      });
    }
  };

  const sendText = () => {
    if (textToSend.trim()) {
      sendCommand('type_text', { text: textToSend });
      setTextToSend('');
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Laptop Remote Controller</Text>
        
        {/* Connection Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <TextInput
            style={styles.input}
            placeholder="Server IP (e.g., 192.168.1.100)"
            value={serverIP}
            onChangeText={setServerIP}
          />
          <TextInput
            style={styles.input}
            placeholder="Port"
            value={serverPort}
            onChangeText={setServerPort}
          />
          <TouchableOpacity
            style={[styles.button, connected ? styles.connected : styles.disconnected]}
            onPress={testConnection}
          >
            <Text style={styles.buttonText}>
              {connected ? '✓ Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Improved Trackpad */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trackpad</Text>
          <PanGestureHandler 
            onGestureEvent={handleTrackpadGesture}
            minDist={0}
            shouldCancelWhenOutside={false}
          >
            <View style={styles.trackpad}>
              <Text style={styles.trackpadText}>
                Move your finger smoothly to control mouse{'\n'}
                Sensitivity: Normal
              </Text>
            </View>
          </PanGestureHandler>
          
          {/* Mouse Buttons */}
          <View style={styles.mouseButtons}>
            <TouchableOpacity
              style={styles.mouseButton}
              onPress={() => sendCommand('click', { button: 'left' })}
            >
              <Text style={styles.mouseButtonText}>Left Click</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mouseButton}
              onPress={() => sendCommand('click', { button: 'right' })}
            >
              <Text style={styles.mouseButtonText}>Right Click</Text>
            </TouchableOpacity>
          </View>

          {/* Scroll Controls */}
          <View style={styles.scrollControls}>
            <TouchableOpacity
              style={styles.scrollButton}
              onPress={() => sendCommand('scroll', { direction: 'up' })}
            >
              <Text style={styles.mouseButtonText}>Scroll Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scrollButton}
              onPress={() => sendCommand('scroll', { direction: 'down' })}
            >
              <Text style={styles.mouseButtonText}>Scroll Down</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Text Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type Text</Text>
          <TextInput
            style={[styles.input, styles.textInput]}
            placeholder="Type text to send to laptop..."
            value={textToSend}
            onChangeText={setTextToSend}
            multiline
          />
          <TouchableOpacity
            style={styles.button}
            onPress={sendText}
          >
            <Text style={styles.buttonText}>Send Text</Text>
          </TouchableOpacity>
        </View>

        {/* Media Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media Controls</Text>
          <View style={styles.mediaControls}>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => sendCommand('media', { action: 'previous' })}
            >
              <Text style={styles.buttonText}>{'<'}Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => sendCommand('media', { action: 'play_pause' })}
            >
              <Text style={styles.buttonText}>{'||'}Play</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => sendCommand('media', { action: 'next' })}
            >
              <Text style={styles.buttonText}>{'>'}Next</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Volume Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume</Text>
          <View style={styles.volumeControls}>
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={() => sendCommand('volume', { action: 'down' })}
            >
              <Text style={styles.buttonText}>Down -</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={() => sendCommand('volume', { action: 'mute' })}
            >
              <Text style={styles.buttonText}>Mute X</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={() => sendCommand('volume', { action: 'up' })}
            >
              <Text style={styles.buttonText}>Up +</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
    marginTop: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  textInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  connected: {
    backgroundColor: '#34C759',
  },
  disconnected: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackpad: {
    width: '100%',
    height: 250,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  trackpadText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  mouseButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mouseButton: {
    backgroundColor: '#007AFF',
    flex: 0.48,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  mouseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollButton: {
    backgroundColor: '#34C759',
    flex: 0.48,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaButton: {
    backgroundColor: '#007AFF',
    flex: 0.3,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  volumeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  volumeButton: {
    backgroundColor: '#007AFF',
    flex: 0.3,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
});

export default App;