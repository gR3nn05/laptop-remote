import socket
import json
import threading
import time
import random
import string
import hashlib
import hmac
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

try:
    from http.server import ThreadingHTTPServer
except ImportError:
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
        pass
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# Configuration
UDP_PORT = 55555
HTTP_PORT = 5000
PAIRING_CODE_LENGTH = 6

class SecurityManager:
    def __init__(self):
        self.pairing_code = self._generate_pairing_code()
        self.key = self._derive_key(self.pairing_code)
        self.used_nonces = {}  # {nonce: timestamp}
        self.cleanup_interval = 60
        self.last_cleanup = time.time()
        
        print(f"\n{'='*40}")
        print(f"   PAIRING CODE: {self.pairing_code}")
        print(f"{'='*40}\n")

    def _generate_pairing_code(self):
        return ''.join(random.choices(string.digits, k=PAIRING_CODE_LENGTH))

    def _derive_key(self, code):
        # SHA-256 hash of the code to get a 32-byte key
        digest = hashlib.sha256(code.encode('utf-8')).digest()
        return digest

    def decrypt_payload(self, encrypted_data):
        """
        Decrypts and verifies the payload.
        """
        try:
            iv_hex = encrypted_data.get('iv')
            ciphertext_b64 = encrypted_data.get('ciphertext')
            received_hmac = encrypted_data.get('hmac')

            if not all([iv_hex, ciphertext_b64, received_hmac]):
                raise ValueError("Missing encryption fields")

            iv = bytes.fromhex(iv_hex)
            ciphertext = base64.b64decode(ciphertext_b64)

            # 1. Verify HMAC
            expected_hmac = hmac.new(
                self.key,
                iv_hex.encode('utf-8') + ciphertext_b64.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(expected_hmac, received_hmac):
                raise ValueError("HMAC verification failed")

            # 2. Decrypt
            cipher = Cipher(algorithms.AES(self.key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(ciphertext) + decryptor.finalize()

            # 3. Unpad
            unpadder = padding.PKCS7(128).unpadder()
            data = unpadder.update(padded_data) + unpadder.finalize()
            
            payload = json.loads(data.decode('utf-8'))

            # 4. Verify Replay Protection
            self._verify_replay(payload)

            return payload

        except Exception as e:
            # print(f"Decryption error: {e}") # Reduce noise
            raise e

    def _verify_replay(self, payload):
        timestamp = payload.get('timestamp')
        nonce = payload.get('nonce')

        if not timestamp or not nonce:
            raise ValueError("Missing timestamp or nonce")

        current_time = time.time() * 1000 # ms
        # Allow 5 seconds window
        if abs(current_time - timestamp) > 60000:
            raise ValueError("Request expired")

        if nonce in self.used_nonces:
            raise ValueError("Replay detected (nonce used)")

        self.used_nonces[nonce] = current_time
        
        if time.time() - self.last_cleanup > self.cleanup_interval:
            self._cleanup_nonces()

    def _cleanup_nonces(self):
        current_time = time.time() * 1000
        self.used_nonces = {k: v for k, v in self.used_nonces.items() if current_time - v < 10000}
        self.last_cleanup = time.time()


class UDPServer(threading.Thread):
    def __init__(self, remote_server):
        super().__init__()
        self.daemon = True
        self.remote_server = remote_server
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('0.0.0.0', UDP_PORT))
        self.running = True

    def run(self):
        print(f"UDP Server listening on port {UDP_PORT}")
        while self.running:
            try:
                data, addr = self.sock.recvfrom(4096)
                try:
                    message = json.loads(data.decode('utf-8'))
                    
                    # Handle Discovery
                    if message.get('type') == 'DISCOVER':
                        response = {
                            'type': 'OFFER',
                            'ip': self.get_local_ip(),
                            'port': HTTP_PORT,
                            'hostname': socket.gethostname()
                        }
                        self.sock.sendto(json.dumps(response).encode('utf-8'), addr)
                        continue

                    # Handle Encrypted Commands (Mouse, etc.)
                    if 'iv' in message:
                        payload = self.remote_server.security.decrypt_payload(message)
                        command = payload.get('command')
                        command_data = payload.get('data', {})
                        self.remote_server.handle_command(command, command_data)
                        
                except Exception as e:
                    # print(f"UDP Packet Error: {e}")
                    pass
            except Exception as e:
                print(f"UDP Socket Error: {e}")

    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"


class LaptopRemoteServer:
    def __init__(self, host='0.0.0.0', port=HTTP_PORT):
        self.host = host
        self.port = port
        self.mouse_controller = MouseController()
        self.keyboard_controller = KeyboardController()
        self.last_move_time = 0
        self.security = SecurityManager()
        
    def handle_command(self, command, data):
        try:
            if command == 'click':
                self.handle_mouse_click(data)
            elif command == 'mouse_move_relative':
                self.handle_mouse_move_relative(data)
            elif command == 'scroll':
                self.handle_scroll(data)
            elif command == 'type_text':
                self.handle_type_text(data)
            elif command == 'type_key':
                self.handle_type_key(data)
            elif command == 'type_enter':
                self.handle_type_enter()
            elif command == 'volume':
                self.handle_volume(data)
            elif command == 'media':
                self.handle_media(data)
            elif command == 'ping':
                return {'status': 'pong'}
            else:
                return {'error': 'Unknown command'}
            return {'status': 'success'}
        except Exception as e:
            print(f"Error handling command {command}: {e}")
            return {'error': str(e)}
    
    def handle_mouse_click(self, data):
        button_type = data.get('button', 'left')
        if button_type == 'left':
            self.mouse_controller.click(Button.left)
        elif button_type == 'right':
            self.mouse_controller.click(Button.right)
    
    def handle_mouse_move_relative(self, data):
        x_offset = data.get('x', 0)
        y_offset = data.get('y', 0)
        
        # Reduced throttle for UDP
        current_time = time.time()
        if current_time - self.last_move_time < 0.001: 
            return
        self.last_move_time = current_time
        
        try:
            self.mouse_controller.move(x_offset, y_offset)
        except Exception as e:
            pass
    
    def handle_scroll(self, data):
        direction = data.get('direction', 'up')
        scroll_amount = 3
        if direction == 'up':
            self.mouse_controller.scroll(0, scroll_amount)
        elif direction == 'down':
            self.mouse_controller.scroll(0, -scroll_amount)
    
    def handle_type_text(self, data):
        text = data.get('text', '')
        self.keyboard_controller.type(text)

    def handle_type_key(self, data):
        key_name = data.get('key')
        try:
            if key_name == 'backspace':
                self.keyboard_controller.press(Key.backspace)
                self.keyboard_controller.release(Key.backspace)
            elif key_name == 'browser_back':
                # Try dedicated key first, then Alt+Left
                try:
                    self.keyboard_controller.press(Key.browser_back)
                    self.keyboard_controller.release(Key.browser_back)
                except:
                    with self.keyboard_controller.pressed(Key.alt):
                        self.keyboard_controller.press(Key.left)
                        self.keyboard_controller.release(Key.left)
            elif key_name == 'browser_forward':
                try:
                    self.keyboard_controller.press(Key.browser_forward)
                    self.keyboard_controller.release(Key.browser_forward)
                except:
                    with self.keyboard_controller.pressed(Key.alt):
                        self.keyboard_controller.press(Key.right)
                        self.keyboard_controller.release(Key.right)
        except Exception as e:
            print(f"Key error: {e}")

    def handle_type_enter(self):
        self.keyboard_controller.press(Key.enter)
        self.keyboard_controller.release(Key.enter)

    def handle_volume(self, data):
        action = data.get('action')
        try:
            if action == 'up':
                self.keyboard_controller.press(Key.media_volume_up)
                self.keyboard_controller.release(Key.media_volume_up)
            elif action == 'down':
                self.keyboard_controller.press(Key.media_volume_down)
                self.keyboard_controller.release(Key.media_volume_down)
            elif action == 'mute':
                self.keyboard_controller.press(Key.media_volume_mute)
                self.keyboard_controller.release(Key.media_volume_mute)
        except Exception as e:
            print(f"Volume control error: {e}")

    def handle_media(self, data):
        action = data.get('action')
        try:
            if action == 'play_pause':
                self.keyboard_controller.press(Key.media_play_pause)
                self.keyboard_controller.release(Key.media_play_pause)
            elif action == 'next':
                self.keyboard_controller.press(Key.media_next)
                self.keyboard_controller.release(Key.media_next)
            elif action == 'previous':
                self.keyboard_controller.press(Key.media_previous)
                self.keyboard_controller.release(Key.media_previous)
        except Exception as e:
            print(f"Media control error: {e}")

    def start_server(self):
        # Start UDP Server
        udp_server = UDPServer(self)
        udp_server.start()

        class RequestHandler(BaseHTTPRequestHandler):
            def __init__(self, remote_server, *args, **kwargs):
                self.remote_server = remote_server
                super().__init__(*args, **kwargs)
            
            def log_message(self, format, *args):
                pass
            
            def do_POST(self):
                if self.path == '/command':
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    
                    try:
                        encrypted_request = json.loads(post_data.decode('utf-8'))
                        payload = self.remote_server.security.decrypt_payload(encrypted_request)
                        
                        command = payload.get('command')
                        command_data = payload.get('data', {})
                        
                        response = self.remote_server.handle_command(command, command_data)
                        
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps(response).encode('utf-8'))
                        
                    except Exception as e:
                        self.send_response(403)
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                else:
                    self.send_response(404)
                    self.end_headers()
            
            def do_GET(self):
                if self.path == '/ping':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'pong'}).encode('utf-8'))
                else:
                    self.send_response(404)
                    self.end_headers()
            
            def do_OPTIONS(self):
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
        
        handler = lambda *args, **kwargs: RequestHandler(self, *args, **kwargs)
        
        server = ThreadingHTTPServer((self.host, self.port), handler)
        print(f"HTTP Server listening on {self.host}:{self.port}")
        server.serve_forever()

if __name__ == "__main__":
    remote_server = LaptopRemoteServer()
    remote_server.start_server()