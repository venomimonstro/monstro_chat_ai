let socketModulePromise: Promise<typeof import('socket.io-client')> | null = null;

export function prefetchSocketClient() {
  if (!socketModulePromise) {
    socketModulePromise = import('socket.io-client');
  }
  return socketModulePromise;
}
