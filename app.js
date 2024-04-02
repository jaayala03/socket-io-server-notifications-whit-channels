const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: 'http://127.0.0.1:5500',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
    }
});

// Crear la conexión con Redis
const redisClient = redis.createClient();

// Objeto para almacenar usuarios conectados y suscripciones
const connectedUsers = {};
const userSubscriptions = {};

// Manejar la conexión de usuarios
io.on('connection', (socket) => {
    console.log('Usuario conectado: ' + socket.id);

    // Agregar usuario a la lista de usuarios conectados
    connectedUsers[socket.id] = socket;

    // Manejar la desconexión de usuarios
    socket.on('disconnect', () => {
        console.log('Usuario desconectado: ' + socket.id);
        // Eliminar usuario de la lista de usuarios conectados
        delete connectedUsers[socket.id];
        
        // Desuscribir al usuario de todos los canales
        if (userSubscriptions[socket.id]) {
            userSubscriptions[socket.id].forEach(channel => {
                redisClient.unsubscribe(channel);
            });
            delete userSubscriptions[socket.id];
        }
    });

    // Manejar la suscripción a un canal
    socket.on('subscribe', (channel) => {
        console.log('Usuario ' + socket.id + ' suscrito a canal: ' + channel);
        
        // Suscribir al usuario al canal en Redis
        redisClient.subscribe(channel);
        
        // Almacenar la suscripción del usuario
        if (!userSubscriptions[socket.id]) {
            userSubscriptions[socket.id] = [channel];
        } else {
            userSubscriptions[socket.id].push(channel);
        }
    });

    // Manejar la desuscripción de un canal
    socket.on('unsubscribe', (channel) => {
        console.log('Usuario ' + socket.id + ' desuscrito de canal: ' + channel);
        
        // Desuscribir al usuario del canal en Redis
        redisClient.unsubscribe(channel);
        
        // Eliminar la suscripción del usuario
        if (userSubscriptions[socket.id]) {
            const index = userSubscriptions[socket.id].indexOf(channel);
            if (index !== -1) {
                userSubscriptions[socket.id].splice(index, 1);
            }
            if (userSubscriptions[socket.id].length === 0) {
                delete userSubscriptions[socket.id];
            }
        }
    });

    // Manejar el envío de notificaciones
    socket.on('enviarNotificacion', (data) => {
        // Enviar la notificación a todos los usuarios suscritos al canal
        Object.values(userSubscriptions).flat().forEach(channel => {
            redisClient.publish(channel, JSON.stringify(data));
        });
    });
});

// Manejar mensajes recibidos desde Redis
redisClient.on('message', (channel, message) => {
    const data = JSON.parse(message);
    io.emit(channel, data);
});

server.listen(3006, () => {
    console.log('Servidor de notificaciones corriendo en el puerto 3006');
});
