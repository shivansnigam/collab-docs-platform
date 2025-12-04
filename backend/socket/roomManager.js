// socket/roomManager.js
import Document from '../models/Document.js';

export class RoomManager {
  constructor({ flushMs = 500 } = {}) {
    this.rooms = new Map();  
    this.timers = new Map();
    this.flushMs = flushMs;
  }

  async initRoomFromDB(docId) {
    if (!this.rooms.has(docId)) {
      const doc = await Document.findById(docId).lean();
      const snapshot = doc?.content ?? '';
      const version = doc?.latestVersion ? doc.latestVersion.toString() : (doc?._id ? 1 : 0);
      this.rooms.set(docId, { snapshot, version, buffer: [], clients: new Map() });
    }
    const { snapshot, version } = this.rooms.get(docId);
    return { docId, snapshot, version };
  }

  addClient(docId, socket, user) {
    if (!this.rooms.has(docId)) this.rooms.set(docId, { snapshot: '', version: 0, buffer: [], clients: new Map() });
    const room = this.rooms.get(docId);
    room.clients.set(socket.id, { socket, user });
  }

  removeClient(docId, socket) {
    const room = this.rooms.get(docId);
    if (!room) return;
    room.clients.delete(socket.id);
    if (room.clients.size === 0) {
      // flush and remove room for memory safety
      this.flush(docId).catch(err => console.error('flush error', err));
      this.rooms.delete(docId);
    }
  }

  receiveOp(docId, op, broadcastFn) {
    if (!this.rooms.has(docId)) this.rooms.set(docId, { snapshot: '', version: 0, buffer: [], clients: new Map() });

    const room = this.rooms.get(docId);

    // For MVP: client sends full snapshot in delta.snapshot (easy)
    // Accept op, increment version, push to buffer and broadcast to others
    room.buffer.push(op);
    room.version = (room.version || 0) + 1;

    // broadcast immediate (others apply)
    broadcastFn({ delta: op.delta, user: op.user, version: room.version });

    // schedule flush if not scheduled
    if (!this.timers.get(docId)) {
      const t = setTimeout(() => this.flush(docId), this.flushMs);
      this.timers.set(docId, t);
    }
  }

  async flush(docId) {
    const room = this.rooms.get(docId);
    if (!room || room.buffer.length === 0) {
      if (this.timers.get(docId)) {
        clearTimeout(this.timers.get(docId));
        this.timers.delete(docId);
      }
      return;
    }

    const ops = room.buffer.splice(0);
    const lastOp = ops[ops.length - 1];
    let newContent = room.snapshot;

    // Expect client to send full snapshot in delta.snapshot
    if (lastOp.delta && lastOp.delta.snapshot !== undefined) {
      newContent = lastOp.delta.snapshot;
    } else {
       
    }

    const newVersion = room.version;

    try {
      // atomic update: increase latestVersion like a number (we store content & updatedAt)
      await Document.findByIdAndUpdate(
        docId,
        { content: newContent, updatedAt: new Date() },
        { upsert: false }
      );
      room.snapshot = newContent;
    } catch (err) {
      console.error('DB persist error for doc', docId, err);
      // on conflict or error: consider notifying clients to re-sync
    } finally {
      if (this.timers.get(docId)) {
        clearTimeout(this.timers.get(docId));
        this.timers.delete(docId);
      }
    }
  }
}
