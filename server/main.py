import socket
import threading
from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController

mouse = MouseController()
keyboard = KeyboardController()

def handle_client(conn, addr):
    print(f"[+] Connection from {addr}")
    try:
        while True:
            data = conn.recv(1024).decode().strip()
            if not data:
                print("[-] Connection closed")
                break
            print(f"[>] Received: {data}")
            try:
                cmd, value = data.split(":")
                if cmd == "mouse_move":
                    x, y = map(int, value.split(","))
                    print(f"[>] Moving mouse to ({x}, {y})")
                    mouse.position = (x, y)
                elif cmd == "mouse_click":
                    print(f"[>] Mouse click: {value}")
                    mouse.click(getattr(Button, value))
                elif cmd == "key_press":
                    print(f"[>] Key press: {value}")
                    keyboard.press(value)
                    keyboard.release(value)
            except Exception as e:
                print(f"[!] Error processing command: {e}")
    except Exception as e:
        print(f"[!] Client handler error: {e}")
    finally:
        conn.close()

def start_server(host='0.0.0.0', port=5000):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind((host, port))
    s.listen()
    print(f"Server listening on {host}:{port}")
    while True:
        conn, addr = s.accept()
        threading.Thread(target=handle_client, args=(conn, addr)).start()

if __name__ == "__main__":
    start_server()