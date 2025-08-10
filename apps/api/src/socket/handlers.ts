import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.userId = decoded.userId;
      socket.data.organizationId = decoded.organizationId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join organization room
    socket.join(`org:${socket.data.organizationId}`);
    
    socket.on('deployment:start', (data) => {
      // Emit deployment status to organization
      io.to(`org:${socket.data.organizationId}`).emit('deployment:status', {
        deploymentId: data.deploymentId,
        status: 'running',
      });
    });
    
    socket.on('deployment:log', (data) => {
      // Emit deployment logs to organization
      io.to(`org:${socket.data.organizationId}`).emit('deployment:log', data);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}