const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// Setup Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve the client files
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
    console.log("Client connected");

    // Simulated DAQ data every second
    setInterval(() => {
        const measurement1 = Math.random() * 100;
        const measurement2 = Math.random() * 100;
        const measurement3 = Math.random() * 100;
        socket.emit("daqData", { measurement1, measurement2, measurement3 });
    }, 1000);
});

// Start the server
server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
