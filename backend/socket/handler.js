// socket/handler.js
import { getUserFromToken } from '../utils/jwtSocketAuth.js';
import { RoomManager } from './roomManager.js';
import { presenceAdd, presenceRemove, getRoomPresence } from './presence.js';

import * as analytics from '../services/analytics.service.js'; // new analytics import

const roomManager = new RoomManager({
  flushMs: parseInt(process.env.BUFFER_FLUSH_MS || '500')
});

export function socketHandler(io, socket) {
  console.log('socket connected', socket.id);

  // ensure per-socket workspace tracking set exists
  if (!socket.data) socket.data = {};
  if (!socket.data.joinedWorkspaces) socket.data.joinedWorkspaces = new Set();

  // JOIN
  socket.on('join', async (payload) => {
    // Added debug log:
    console.log('JOIN-received', { socketId: socket.id, payload: { docId: payload?.docId, workspaceId: payload?.workspaceId } });

    try {
      const { token, docId, workspaceId } = payload || {};
      if (!token || !docId)
        return socket.emit('error', { message: 'join: token/docId required' });

      // note: workspaceId is optional in your existing flow, analytics needs it.
      const user = await getUserFromToken(token);
      if (!user)
        return socket.emit('error', { message: 'Authentication failed' });

      socket.data.user = {
        id: user._id.toString(),
        name: user.name,
        roles: user.roles
      };

      // ⭐ NEW: join personal user room so server can emit per-user notifications
      try {
        const userRoom = `user:${socket.data.user.id}`;
        socket.join(userRoom);
        console.log(`socket ${socket.id} joined personal room ${userRoom}`);
      } catch (e) {
        console.error('failed to join user personal room', e);
      }

      // store workspaceId on socket if provided (used on disconnect)
      if (workspaceId) {
        socket.data.workspaceId = workspaceId;
        console.log(`socket ${socket.id} stored workspaceId ${workspaceId}`);
      }

      socket.join(docId);
      console.log(`socket ${socket.id} joined room ${docId}`);

      presenceAdd(docId, socket.id, socket.data.user);
      io.to(docId).emit('presence:update', getRoomPresence(docId));

      // Analytics: increase active users (workspace level) if workspaceId provided
      // GUARD: only increment once per socket per workspace
      if (workspaceId) {
        try {
          if (!socket.data.joinedWorkspaces.has(workspaceId)) {
            // mark as joined for this socket, then increment
            socket.data.joinedWorkspaces.add(workspaceId);
            console.log(`socket ${socket.id} adding workspace ${workspaceId} to joinedWorkspaces set`);
            const res = await analytics.incActiveUsers(workspaceId, 1);
            console.log('analytics.incActiveUsers (join) result', { workspaceId, updated: res?.activeUsersCount });
          } else {
            console.log(`socket ${socket.id} already marked joined for workspace ${workspaceId}`);
          }
          await analytics.pushActivity({ workspaceId, docId, userId: user._id, action: 'join', meta: { docId } });
        } catch (e) {
          console.error('analytics.join.error', e);
        }
      } else {
        console.log(`JOIN: workspaceId not provided by client for socket ${socket.id}`);
      }

      const init = await roomManager.initRoomFromDB(docId);
      socket.emit('init', init);

      roomManager.addClient(docId, socket, socket.data.user);
    } catch (err) {
      console.error('join error', err);
      socket.emit('error', { message: 'join failed' });
    }
  });

  // DOC UPDATE
  socket.on('doc:update', (payload) => {
    const { docId, delta, version, workspaceId } = payload || {};
    const user = socket.data.user;
    if (!user)
      return socket.emit('error', { message: 'Not authenticated' });
    if (!docId || !delta)
      return socket.emit('error', { message: 'doc:update missing fields' });

    roomManager.receiveOp(
      docId,
      { socketId: socket.id, user, delta, version },
      async (broadcast) => {
        socket.to(docId).emit('doc:update', broadcast);

        // analytics: increment edits by 1 (workspace-level) if workspaceId provided
        try {
          if (workspaceId) {
            await analytics.incEdits(workspaceId, user.id, docId, 1);
          } else if (socket.data.workspaceId) {
            // fallback to stored workspaceId if client didn't send it this time
            await analytics.incEdits(socket.data.workspaceId, user.id, docId, 1);
          }
        } catch (e) {
          console.error('analytics.doc.update', e);
        }
      }
    );
  });

  // CURSOR UPDATE
  socket.on('cursor:update', (payload) => {
    const { docId, selection } = payload || {};
    if (!docId) return;

    presenceAdd(docId, socket.id, {
      ...socket.data.user,
      selection
    });

    socket.to(docId).emit('cursor:update', {
      user: socket.data.user,
      selection
    });
  });

  // ✅ FIXED TYPING EVENT (NAME + USERID MUST SEND)
  socket.on('typing', (payload) => {
    const { docId, isTyping, userId, name } = payload || {};
    if (!docId) return;

    // user info to broadcast
    const typingUser = {
      id: userId || socket.data.user.id,
      name: name || socket.data.user.name,
      socketId: socket.id
    };

    // update local presence store
    presenceAdd(docId, socket.id, {
      ...typingUser,
      isTyping
    });

    // broadcast to others
    socket.to(docId).emit('presence:typing', {
      user: typingUser,
      isTyping
    });
  });

  // LEAVE
  socket.on('leave', async (payload) => {
    try {
      const { docId, workspaceId } = payload || {};
      if (!docId) return;

      console.log(`LEAVE received from socket ${socket.id}`, { docId, workspaceId });

      socket.leave(docId);
      presenceRemove(docId, socket.id);
      io.to(docId).emit('presence:update', getRoomPresence(docId));
      roomManager.removeClient(docId, socket);

      const wsId = workspaceId || socket.data?.workspaceId;
      if (wsId) {
        try {
          // only decrement if this socket previously registered a join for the same workspace
          if (socket.data.joinedWorkspaces && socket.data.joinedWorkspaces.has(wsId)) {
            socket.data.joinedWorkspaces.delete(wsId);
            console.log(`LEAVE: decremented active users for workspace ${wsId} (socket ${socket.id})`);
            const res = await analytics.incActiveUsers(wsId, -1);
            console.log('analytics.incActiveUsers (leave) result', { workspaceId: wsId, updated: res?.activeUsersCount });
          } else {
            console.log(`LEAVE: socket ${socket.id} had not joined workspace ${wsId} previously`);
          }
          await analytics.pushActivity({ workspaceId: wsId, docId, userId: socket.data.user?.id, action: 'leave', meta: { docId } });
        } catch (e) {
          console.error('analytics.leave.err', e);
        }
      } else {
        console.log(`LEAVE: no workspaceId available for socket ${socket.id}`);
      }
    } catch (err) {
      console.error('leave handler error', err);
    }
  });

  // DISCONNECT
  socket.on('disconnect', async (reason) => {
    try {
      console.log(`disconnect event for socket ${socket.id}`, { reason, joinedWorkspaces: Array.from(socket.data?.joinedWorkspaces || []) });

      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      for (const docId of rooms) {
        presenceRemove(docId, socket.id);
        io.to(docId).emit('presence:update', getRoomPresence(docId));
        roomManager.removeClient(docId, socket);

        // replaced single workspaceId logic with loop over joinedWorkspaces
        const joined = Array.from(socket.data?.joinedWorkspaces || []);
        console.log(`disconnect: socket ${socket.id} processing joined workspaces`, { joined });
        for (const wsId of joined) {
          try {
            if (socket.data.joinedWorkspaces && socket.data.joinedWorkspaces.has(wsId)) {
              socket.data.joinedWorkspaces.delete(wsId);
              console.log(`disconnect: decrementing active users for workspace ${wsId} (socket ${socket.id})`);
              const res = await analytics.incActiveUsers(wsId, -1);
              console.log('analytics.incActiveUsers (disconnect) result', { workspaceId: wsId, updated: res?.activeUsersCount });
            } else {
              console.log(`disconnect: socket ${socket.id} join set did not contain ${wsId}`);
            }
            await analytics.pushActivity({ workspaceId: wsId, docId, userId: socket.data.user?.id, action: 'disconnect', meta: {} });
          } catch (e) {
            console.error('analytics.disconnect.err', e);
          }
        }
      }
    } catch (err) {
      console.error('disconnect handler error', err);
    }
    console.log('socket disconnected', socket.id);
  });
}
