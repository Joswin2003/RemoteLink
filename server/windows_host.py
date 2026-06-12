"""
Windows-specific host server additions.
When running on Windows, this patches the host_server module
to use Windows APIs for screen capture and input control.
"""
import sys
import platform

if platform.system() == "Windows":
    import ctypes
    import subprocess
    import base64
    import io

    def capture_screen_windows(quality=40):
        """Capture screen on Windows using PIL/pywin32"""
        try:
            from PIL import ImageGrab
            import io as _io
            img = ImageGrab.grab()
            w, h = img.size
            # Scale down for performance
            img = img.resize((w // 2, h // 2))
            buf = _io.BytesIO()
            img.save(buf, "JPEG", quality=quality)
            return buf.getvalue()
        except Exception as e:
            print(f"[Windows] Capture error: {e}")
            return None

    def move_mouse_windows(x, y):
        ctypes.windll.user32.SetCursorPos(x, y)

    def click_mouse_windows(x, y, button=1):
        ctypes.windll.user32.SetCursorPos(x, y)
        if button == 1:
            ctypes.windll.user32.mouse_event(0x0002, 0, 0, 0, 0)  # left down
            ctypes.windll.user32.mouse_event(0x0004, 0, 0, 0, 0)  # left up
        elif button == 3:
            ctypes.windll.user32.mouse_event(0x0008, 0, 0, 0, 0)  # right down
            ctypes.windll.user32.mouse_event(0x0010, 0, 0, 0, 0)  # right up

    def scroll_mouse_windows(x, y, direction):
        ctypes.windll.user32.SetCursorPos(x, y)
        delta = 120 if direction == 'up' else -120
        ctypes.windll.user32.mouse_event(0x0800, 0, 0, delta, 0)

    def press_key_windows(key):
        VK_MAP = {
            'Return': 0x0D, 'BackSpace': 0x08, 'Delete': 0x2E,
            'Escape': 0x1B, 'Tab': 0x09, 'Up': 0x26, 'Down': 0x28,
            'Left': 0x25, 'Right': 0x27, 'space': 0x20,
            'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73,
            'F5': 0x74, 'F6': 0x75, 'F7': 0x76, 'F8': 0x77,
            'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
            'Home': 0x24, 'End': 0x23, 'Prior': 0x21, 'Next': 0x22,
        }
        parts = key.split('+')
        mods = parts[:-1]
        base = parts[-1]

        for mod in mods:
            if mod == 'ctrl': ctypes.windll.user32.keybd_event(0x11, 0, 0, 0)
            if mod == 'alt': ctypes.windll.user32.keybd_event(0x12, 0, 0, 0)
            if mod == 'shift': ctypes.windll.user32.keybd_event(0x10, 0, 0, 0)

        vk = VK_MAP.get(base)
        if not vk and len(base) == 1:
            vk = ctypes.windll.user32.VkKeyScanA(ord(base)) & 0xFF
        if vk:
            ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
            ctypes.windll.user32.keybd_event(vk, 0, 2, 0)

        for mod in reversed(mods):
            if mod == 'ctrl': ctypes.windll.user32.keybd_event(0x11, 0, 2, 0)
            if mod == 'alt': ctypes.windll.user32.keybd_event(0x12, 0, 2, 0)
            if mod == 'shift': ctypes.windll.user32.keybd_event(0x10, 0, 2, 0)

    def type_text_windows(text):
        import ctypes
        for ch in text:
            vk = ctypes.windll.user32.VkKeyScanA(ord(ch))
            if vk != -1:
                ctypes.windll.user32.keybd_event(vk & 0xFF, 0, 0, 0)
                ctypes.windll.user32.keybd_event(vk & 0xFF, 0, 2, 0)

    # Monkey-patch host_server functions
    import server.host_server as hs
    hs.capture_screen_jpeg = capture_screen_windows
    hs.move_mouse = move_mouse_windows
    hs.click_mouse = click_mouse_windows
    hs.scroll_mouse = scroll_mouse_windows
    hs.press_key = press_key_windows
    hs.type_text = type_text_windows

    print("[Windows] Windows input/capture handlers installed")
