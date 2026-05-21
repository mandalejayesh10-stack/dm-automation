import type { Server } from "socket.io";

let io: Server | null = null;

export function setRealtimeServer(server: Server) {
  io = server;
}

export function emitBrandEvent(brandId: string, event: string, payload: unknown) {
  io?.to(`brand:${brandId}`).emit(event, payload);
}

export function emitUserEvent(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
