// realtime-server.js
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { Server } from 'socket.io';
import { socketHandler } from './socket/handler.js';

// ⭐ NEW IMPORT — global io store
import { setIo } from './socket/io.js';

const start = async () => {
  try {
    await connectDB();
    const port = process.env.PORT;
    //  const port = process.env.REALTIME_PORT;
    const server = http.createServer();

    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
      },
      maxHttpBufferSize: 1e6
    });

    // ⭐ NEW LINE — set io globally so notifications work everywhere
    setIo(io);

    io.on('connection', (socket) => socketHandler(io, socket));

    server.listen(port, () => {
      console.log(`Realtime server running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start realtime server', err);
    process.exit(1);
  }
};

start();
