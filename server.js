const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/ports", async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports.map(p => p.path));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ports" });
  }
});

let port;
let parser;
let isPortOpen = false;
let selectedPortPath = "COM3";

function notifyClientsDisconnected() {
  io.emit("daqData", {
    temperature: 0,
    voltage: 0,
    measurement3: 0,
    sensorConnected: false
  });
}

function createPort(portPath) {
  if (isPortOpen) {
    console.log("Port already open.");
    return;
  }

  selectedPortPath = portPath || selectedPortPath;

  port = new SerialPort({
    path: selectedPortPath,
    baudRate: 9600,
    autoOpen: false
  });

  parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.open((err) => {
    if (err) {
      console.error("Error opening port:", err.message);
      isPortOpen = false;
    } else {
      console.log("Serial Port Opened:", selectedPortPath);
      isPortOpen = true;
    }
  });

  port.on("close", () => {
    console.warn("Serial Port Closed");
    isPortOpen = false;
    notifyClientsDisconnected();
  });

  port.on("error", (err) => {
    console.error("Serial Port Error:", err.message);
    isPortOpen = false;
    notifyClientsDisconnected();
  });

  parser.on("data", (line) => {
    try {
      const [m1, m2, m3] = line.split(",").map(Number);
      const sensorConnected = !isNaN(m1);

      const data = {
        temperature: m1,
        voltage: m2 || 0,
        measurement3: m3 || 0,
        sensorConnected
      };

      io.emit("daqData", data);
    } catch (err) {
      console.error("Parse error:", err.message, "Line:", line);
    }
  });
}


// Start everything
createPort();

// Listen for client connections
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