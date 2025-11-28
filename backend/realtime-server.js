// realtime-server.js
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { Server } from 'socket.io';
import { socketHandler } from './socket/handler.js';

const start = async () => {
  try {
    await connectDB();
    const port = process.env.REALTIME_PORT || 1234;
    const server = http.createServer();

    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
      },
      maxHttpBufferSize: 1e6
    });

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
