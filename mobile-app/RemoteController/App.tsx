import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import dgram from 'react-native-udp';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

const UDP_PORT = 55555;

const App = () => {
  const [serverIP, setServerIP] = useState('');
  const [serverPort, setServerPort] = useState('5000');
  const [pairingCode, setPairingCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [serverName, setServerName] = useState('');
  const [udpSocket, setUdpSocket] = useState<any>(null);

  // Trackpad smoothing variables
  const lastMoveTime = useRef(0);

  // Initialize UDP Socket
  useEffect(() => {
    let socket: any;
    try {
      socket = dgram.createSocket({ type: 'udp4' });
      socket.bind(0);
      setUdpSocket(socket);
    } catch (e) {
      console.log('UDP Setup Error', e);
    }

    return () => {
      if (socket) {
        try { socket.close(); } catch (e) { }
      }
    };
  }, []);

  const deriveKey = (code: string) => {
    return CryptoJS.SHA256(code);
  };

  const encryptPayload = (command: string, data: any = {}) => {
    try {
      const key = deriveKey(pairingCode);
      const iv = CryptoJS.lib.WordArray.random(16);

      const payload = JSON.stringify({
        command,
        data,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7),
      });

      const encrypted = CryptoJS.AES.encrypt(payload, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const ciphertext = encrypted.toString();
      const ivHex = iv.toString(CryptoJS.enc.Hex);

      // HMAC over IV + Ciphertext
      const hmac = CryptoJS.HmacSHA256(ivHex + ciphertext, key).toString(CryptoJS.enc.Hex);

      return {
        iv: ivHex,
        ciphertext: ciphertext,
        hmac: hmac,
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  };

  const sendCommand = async (command: string, data?: any, protocol: 'http' | 'udp' = 'http') => {
    if (!serverIP || !pairingCode) {
      if (protocol === 'http') Alert.alert('Error', 'Connect first');
      return;
    }

    try {
      const encryptedData = encryptPayload(command, data);

      if (protocol === 'udp' && udpSocket) {
        try {
          const message = JSON.stringify(encryptedData);
          udpSocket.send(message, 0, message.length, UDP_PORT, serverIP, (err: any) => {
            // Silent fail for UDP to keep performance high
          });
        } catch (e) {
          // Silent catch
        }
      } else {
        // HTTP Fallback / Default
        const response = await fetch(`http://${serverIP}:${serverPort}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encryptedData),
        });

        if (!response.ok) {
          if (response.status === 403) {
            Alert.alert('Security Error', 'Check Pairing Code');
            setConnected(false);
          } else {
            console.log('Command failed', response.status);
          }
        }
      }
    } catch (error: any) {
      if (protocol === 'http') {
        console.log('Connection Error', error);
        Alert.alert('Connection Error', error.message || 'Unknown error');
        setConnected(false);
      }
    }
  };

  const discoverServer = () => {
    setScanning(true);
    setServerIP('');
    setServerName('');
    setConnected(false);

    const socket = dgram.createSocket({ type: 'udp4' });
    socket.bind(UDP_PORT);

    socket.once('listening', () => {
      socket.setBroadcast(true);
      const message = JSON.stringify({ type: 'DISCOVER' });
      socket.send(message, 0, message.length, UDP_PORT, '255.255.255.255', (err) => {
        if (err) console.log('UDP Send Error', err);
      });
    });

    socket.on('message', (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        if (response.type === 'OFFER') {
          setServerIP(response.ip);
          setServerPort(response.port.toString());
          setServerName(response.hostname || rinfo.address);
          setScanning(false);
          socket.close();
          Alert.alert('Connected', `Found ${response.hostname}`);
        }
      } catch (e) {
        console.log('UDP Parse Error', e);
      }
    });

    setTimeout(() => {
      if (scanning) {
        setScanning(false);
        try { socket.close(); } catch (e) { }
        if (!serverIP) Alert.alert('Timeout', 'No server found');
      }
    }, 3000);
  };

  const testConnection = async () => {
    if (!serverIP) {
      Alert.alert('Error', 'Scan first.');
      return;
    }
    try {
      await sendCommand('ping');
      setConnected(true);
      Alert.alert('Success', 'Ready to control!');
    } catch (e) {
      setConnected(false);
    }
  };

  const handleTrackpadGesture = (event: PanGestureHandlerGestureEvent) => {
    const { velocityX, velocityY } = event.nativeEvent;
    const now = Date.now();

    // Very low throttle for UDP (8ms = ~120fps cap)
    if (now - lastMoveTime.current < 8) return;
    lastMoveTime.current = now;

    const sensitivity = 0.025;
    const smoothX = velocityX * sensitivity;
    const smoothY = velocityY * sensitivity;

    if (Math.abs(smoothX) > 0.05 || Math.abs(smoothY) > 0.05) {
      // Always use UDP for mouse movement
      sendCommand('mouse_move_relative', {
        x: Math.round(smoothX),
        y: Math.round(smoothY)
      }, 'udp');
    }
  };

  const handleKeyPress = ({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Backspace') {
      sendCommand('type_key', { key: 'backspace' });
    } else {
      // For some reason, React Native TextInput onKeyPress might not fire for all chars on Android
      // So we also use onChangeText for characters
    }
  };

  const handleChangeText = (text: string) => {
    if (text.length > 0) {
      const char = text.slice(-1);
      sendCommand('type_text', { text: char });
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>CONTROLLER</Text>

        {/* Connection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, connected ? styles.dotGreen : styles.dotRed]} />
              <Text style={styles.statusText}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
            </View>
            {serverName ? <Text style={styles.serverName}>{serverName}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="PAIRING CODE"
              placeholderTextColor="#555"
              value={pairingCode}
              onChangeText={setPairingCode}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={discoverServer}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SCAN</Text>}
            </TouchableOpacity>
            <View style={{ width: 10 }} />
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={testConnection}>
              <Text style={styles.buttonText}>{connected ? 'PAIRED' : 'PAIR'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trackpad */}
        <View style={styles.trackpadContainer}>
          <PanGestureHandler onGestureEvent={handleTrackpadGesture}>
            <View style={styles.trackpad}>
              <Text style={styles.trackpadLabel}>TOUCH SURFACE</Text>
            </View>
          </PanGestureHandler>

          <View style={styles.mouseRow}>
            <TouchableOpacity style={styles.mouseBtn} onPress={() => sendCommand('click', { button: 'left' })}>
              <Text style={styles.btnLabel}>L</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mouseBtn} onPress={() => sendCommand('click', { button: 'right' })}>
              <Text style={styles.btnLabel}>R</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scrollRow}>
            <TouchableOpacity style={styles.scrollBtn} onPress={() => sendCommand('scroll', { direction: 'up' })}>
              <Text style={styles.btnLabel}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scrollBtn} onPress={() => sendCommand('scroll', { direction: 'down' })}>
              <Text style={styles.btnLabel}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Controls Grid */}
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>INPUT</Text>
            <TextInput
              style={styles.miniInput}
              placeholder="TYPE..."
              placeholderTextColor="#444"
              onKeyPress={handleKeyPress}
              onChangeText={handleChangeText}
              value=""
              autoCorrect={false}
            />
            <View style={styles.miniRow}>
              <TouchableOpacity style={styles.miniBtn} onPress={() => sendCommand('type_key', { key: 'backspace' })}>
                <Text style={styles.miniBtnText}>⌫</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniBtn} onPress={() => sendCommand('type_enter')}>
                <Text style={styles.miniBtnText}>↵</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.gridCol}>
            <Text style={styles.sectionLabel}>NAV</Text>
            <View style={styles.miniRow}>
              <TouchableOpacity style={styles.miniBtn} onPress={() => sendCommand('type_key', { key: 'browser_back' })}>
                <Text style={styles.miniBtnText}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniBtn} onPress={() => sendCommand('type_key', { key: 'browser_forward' })}>
                <Text style={styles.miniBtnText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Media Bar */}
        <View style={styles.mediaBar}>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => sendCommand('media', { action: 'previous' })}>
            <Text style={styles.mediaText}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtnMain} onPress={() => sendCommand('media', { action: 'play_pause' })}>
            <Text style={styles.mediaTextMain}>⏯</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => sendCommand('media', { action: 'next' })}>
            <Text style={styles.mediaText}>⏭</Text>
          </TouchableOpacity>
        </View>

        {/* Volume Bar */}
        <View style={styles.volumeBar}>
          <TouchableOpacity style={styles.volBtn} onPress={() => sendCommand('volume', { action: 'down' })}>
            <Text style={styles.volText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.volBtn} onPress={() => sendCommand('volume', { action: 'mute' })}>
            <Text style={styles.volText}>MUTE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.volBtn} onPress={() => sendCommand('volume', { action: 'up' })}>
            <Text style={styles.volText}>+</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 4, textAlign: 'center', marginBottom: 25, opacity: 0.8 },

  card: { backgroundColor: '#111', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotGreen: { backgroundColor: '#00ff00', shadowColor: '#00ff00', shadowRadius: 5, shadowOpacity: 1 },
  dotRed: { backgroundColor: '#ff0000' },
  statusText: { color: '#888', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  serverName: { color: '#444', fontSize: 10, fontWeight: 'bold' },

  inputContainer: { backgroundColor: '#0a0a0a', borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
  input: { color: '#fff', padding: 12, textAlign: 'center', fontSize: 18, letterSpacing: 2, fontWeight: 'bold' },

  row: { flexDirection: 'row' },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: '#fff' },
  buttonSecondary: { backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  buttonText: { fontWeight: 'bold', fontSize: 12, letterSpacing: 1, color: '#000' },

  trackpadContainer: { marginBottom: 20 },
  trackpad: { height: 200, backgroundColor: '#0f0f0f', borderRadius: 12, borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  trackpadLabel: { color: '#333', fontSize: 10, letterSpacing: 2 },

  mouseRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  mouseBtn: { flex: 0.48, backgroundColor: '#111', padding: 20, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  scrollRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scrollBtn: { flex: 0.48, backgroundColor: '#111', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  btnLabel: { color: '#666', fontWeight: 'bold' },

  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  gridCol: { flex: 0.48, backgroundColor: '#111', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  sectionLabel: { color: '#444', fontSize: 10, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  miniInput: { backgroundColor: '#0a0a0a', color: '#fff', padding: 8, borderRadius: 4, marginBottom: 10, fontSize: 12 },
  miniRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniBtn: { backgroundColor: '#222', width: 35, height: 35, borderRadius: 17.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  miniBtnText: { color: '#fff', fontSize: 12 },

  mediaBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  mediaBtn: { padding: 10 },
  mediaBtnMain: { backgroundColor: '#fff', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  mediaText: { color: '#fff', fontSize: 20 },
  mediaTextMain: { color: '#000', fontSize: 20 },

  volumeBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111', padding: 5, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  volBtn: { flex: 1, padding: 15, alignItems: 'center' },
  volText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
});

export default App;