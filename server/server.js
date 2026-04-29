require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Sentiment = require('sentiment');
const mongoose = require('mongoose');

// Use the environment variable, or fallback to local if it's missing
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sentimentChat';
const PORT = process.env.PORT || 3000;

// Connect using the variable!
mongoose.connect(mongoURI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("Could not connect", err));

const messageSchema = new mongoose.Schema({
    text: String,
    score: Number,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const sentiment = new Sentiment();

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // Fetch history
    Message.find().sort({ timestamp: -1 }).limit(10).then(messages => {
        socket.emit('load_history', messages.reverse());
    });

    socket.on('chat_message', async (msg) => {
        const result = sentiment.analyze(msg);
        const analyzedData = {
            text: msg,
            score: result.score,
            comparative: result.comparative
        };

        try {
            const newMessage = new Message({ text: msg, score: result.score });
            await newMessage.save();
            io.emit('chat_message', analyzedData);
        } catch (err) {
            console.error("Database Save Error:", err);
            io.emit('chat_message', analyzedData);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});