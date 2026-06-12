"""Relay server stub - for cross-network relay support"""

class RelayServer:
    def __init__(self, port=8767):
        self.port = port

    def start(self):
        pass  # Can be expanded for NAT traversal
