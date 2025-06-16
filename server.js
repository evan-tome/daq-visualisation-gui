const express = require("express"); // Web framework for Node.js
const http = require("http");
const socketIo = require("socket.io"); // Real-time WebSocket library
const path = require("path");
const { SerialPort } = require("serialport"); // Serial communication
const { ReadlineParser } = require("@serialport/parser-readline"); // Line-based parser for serial data

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Attach socket.io to the server

app.use(express.static(path.join(__dirname, "public")));

app.get("/ports", async (req, res) => {
  try {
    const ports = await SerialPort.list(); // Get list of available serial ports
    res.json(ports.map(p => p.path));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ports" });
  }
});

// Serial port and parser variables
let port;
let parser;
let isPortOpen = false;
let selectedPortPath = "COM3"; // Default port path


// Notify that the sensor is disconnected
function notifyDisconnected() {
  io.emit("daqData", {
    temperature: 0,
    voltage: 0,
    measurement3: 0,
    sensorConnected: false
  });
}

// Create and open a serial port
function createPort(portPath) {
  if (isPortOpen) {
    console.log("Port already open.");
    return; // Prevent reopening if already open
  }

  // Update port path if provided
  selectedPortPath = portPath || selectedPortPath;

  port = new SerialPort({
    path: selectedPortPath,
    baudRate: 9600,
    autoOpen: false
  });

  parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  // Attempt to open the serial port
  port.open((err) => {
    if (err) {
      console.error("Error opening port:", err.message);
      isPortOpen = false;
    } else {
      console.log("Serial Port Opened:", selectedPortPath);
      isPortOpen = true;
    }
  });

  // Handle port close event
  port.on("close", () => {
    console.warn("Serial Port Closed");
    isPortOpen = false;
    notifyDisconnected();
  });

  // Handle port error event
  port.on("error", (err) => {
    console.error("Serial Port Error:", err.message);
    isPortOpen = false;
    notifyDisconnected();
  });

  // Handle incoming serial data
  parser.on("data", (line) => {
    try {

    // Parse line (e.g., "23.5,5.0,1")
    const [m1, m2, m3] = line.split(",").map(Number);
    const sensorConnected = !isNaN(m1);

    const data = {
        temperature: m1,
        voltage: m2 || 0,
        measurement3: m3 || 0,
        sensorConnected
    };

    io.emit("daqData", data); // Send data to all clients
    } catch (err) {
        console.error("Parse error:", err.message, "Line:", line);
    }
  });
}


// Start the serial connection with the default port
createPort();

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("createPort", (portPath) => {
    console.log("Reconnect request to port:", portPath);
    createPort(portPath);
  });
});

// Start the server
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});