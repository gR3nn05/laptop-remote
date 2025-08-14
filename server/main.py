import socket
import json
import subprocess
import platform
import os
import time
from pynput.mouse import Button, Listener as MouseListener
from pynput.keyboard import Key, Listener as KeyboardListener
import pynput.mouse as mouse
import pynput.keyboard as keyboard

class LaptopRemoteServer:
    def __init__(self, host='0.0.0.0', port=5000):
        self.host = host
        self.port = port
        self.mouse_controller = mouse.Controller()
        self.keyboard_controller = keyboard.Controller()
        self.last_move_time = 0
        
    def handle_command(self, command, data):
        """Handle different types of commands"""
        try:
            if command == 'click':
                self.handle_mouse_click(data)
            elif command == 'mouse_move_relative':
                self.handle_mouse_move_relative(data)
            elif command == 'scroll':
                self.handle_scroll(data)
            elif command == 'type_text':
                self.handle_type_text(data)
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
        """Handle mouse click commands"""
        button_type = data.get('button', 'left')
        if button_type == 'left':
            self.mouse_controller.click(Button.left)
        elif button_type == 'right':
            self.mouse_controller.click(Button.right)
    
    def handle_mouse_move_relative(self, data):
        """Handle relative mouse movement (smoother)"""
        x_offset = data.get('x', 0)
        y_offset = data.get('y', 0)
        
        # Light throttling on server side
        current_time = time.time()
        if current_time - self.last_move_time < 0.005:  # 5ms throttle
            return
        self.last_move_time = current_time
        
        # Get current position and move relative to it
        try:
            current_x, current_y = self.mouse_controller.position
            new_x = current_x + x_offset
            new_y = current_y + y_offset
            
            # Basic bounds checking (adjust for your screen resolution)
            new_x = max(0, min(1920, new_x))  # Adjust 1920 to your screen width
            new_y = max(0, min(1080, new_y))  # Adjust 1080 to your screen height
            
            self.mouse_controller.position = (new_x, new_y)
        except Exception as e:
            print(f"Mouse move error: {e}")
    
    def handle_scroll(self, data):
        """Handle mouse scroll"""
        direction = data.get('direction', 'up')
        scroll_amount = 3
        
        if direction == 'up':
            self.mouse_controller.scroll(0, scroll_amount)
        elif direction == 'down':
            self.mouse_controller.scroll(0, -scroll_amount)
    
    def handle_type_text(self, data):
        """Handle typing text"""
        text = data.get('text', '')
        self.keyboard_controller.type(text)
    
    def handle_volume(self, data):
        """Handle volume control commands"""
        action = data.get('action')
        system = platform.system().lower()
        
        try:
            if system == 'linux':
                if action == 'up':
                    result = subprocess.run(['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'], 
                                          capture_output=True, text=True)
                    if result.returncode != 0:
                        subprocess.run(['amixer', 'set', 'Master', '5%+'], capture_output=True)
                elif action == 'down':
                    result = subprocess.run(['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '-5%'], 
                                          capture_output=True, text=True)
                    if result.returncode != 0:
                        subprocess.run(['amixer', 'set', 'Master', '5%-'], capture_output=True)
                elif action == 'mute':
                    result = subprocess.run(['pactl', 'set-sink-mute', '@DEFAULT_SINK@', 'toggle'], 
                                          capture_output=True, text=True)
                    if result.returncode != 0:
                        subprocess.run(['amixer', 'set', 'Master', 'toggle'], capture_output=True)
            elif system == 'windows':
                if action == 'up':
                    self.keyboard_controller.press(Key.media_volume_up)
                    self.keyboard_controller.release(Key.media_volume_up)
                elif action == 'down':
                    self.keyboard_controller.press(Key.media_volume_down)
                    self.keyboard_controller.release(Key.media_volume_down)
                elif action == 'mute':
                    self.keyboard_controller.press(Key.media_volume_mute)
                    self.keyboard_controller.release(Key.media_volume_mute)
            elif system == 'darwin':  # macOS support as bonus
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
        """Handle media control commands"""
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
        """Start the HTTP server"""
        from http.server import HTTPServer, BaseHTTPRequestHandler
        
        class RequestHandler(BaseHTTPRequestHandler):
            def __init__(self, remote_server, *args, **kwargs):
                self.remote_server = remote_server
                super().__init__(*args, **kwargs)
            
            def log_message(self, format, *args):
                pass  # Suppress logging
            
            def do_POST(self):
                if self.path == '/command':
                    content_length = int(self.headers['Content-Length'])
                    post_data = self.rfile.read(content_length)
                    
                    try:
                        data = json.loads(post_data.decode('utf-8'))
                        command = data.get('command')
                        command_data = data.get('data', {})
                        
                        response = self.remote_server.handle_command(command, command_data)
                        
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps(response).encode('utf-8'))
                        
                    except Exception as e:
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
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
        
        server = HTTPServer((self.host, self.port), handler)
        print(f"Server listening on {self.host}:{self.port}")
        print(f"Connect your phone to: http://{self.get_local_ip()}:{self.port}")
        server.serve_forever()
    
    def get_local_ip(self):
        """Get local IP address"""
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "localhost"

if __name__ == "__main__":
    remote_server = LaptopRemoteServer()
    remote_server.start_server()