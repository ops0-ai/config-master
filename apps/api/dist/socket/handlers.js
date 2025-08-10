"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function setupSocketHandlers(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.userId = decoded.userId;
            socket.data.organizationId = decoded.organizationId;
            next();
        }
        catch (err) {
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
//# sourceMappingURL=handlers.js.map