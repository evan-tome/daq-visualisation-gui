const express = require("express"); // Web framework for Node.js
const http = require("http");
const socketIo = require("socket.io"); // Real-time WebSocket library
const path = require("path");
const { SerialPort } = require("serialport"); // Serial communication
const { ReadlineParser } = require("@serialport/parser-readline"); // Line-based parser for serial data

// Recording to CSV file
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

let isRecording = false;
let csvWriter;

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Attach socket.io to the server

const bufferSize = 10;
const voltageBuffer = [];
const currentBuffer = [];
const temperatureBuffer = [];

function computeAverage(buffer, newValue) {
  buffer.push(newValue);
  if (buffer.length > bufferSize) buffer.shift();

  const sum = buffer.reduce((acc, val) => acc + val, 0);
  return + (sum / buffer.length).toFixed(2);
}

function getTimestamp() {
  const now = new Date();

  // Format date and time components
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // Compose string: YYYY-MM-DD_HH-MM-SS.csv
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

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
    voltage: 0,
    current: 0,
    temperature: 0,
    sensorConnected: false
  });
}

// Create and open a serial port
function createPort(portPath, socket) {
  if (isPortOpen) {
    console.log("Closing existing port:", selectedPortPath);
    port.close();
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

      // Notify this specific client only
      if (socket) {
        socket.emit("portError", `Failed to connect to port: ${selectedPortPath}`);
      }

      return;
    }

    console.log("Serial Port Opened:", selectedPortPath);
    isPortOpen = true;
  });

  port.on("close", () => {
    console.warn("Serial Port Closed");
    isPortOpen = false;
    notifyDisconnected();
  });

  port.on("error", (err) => {
    console.error("Serial Port Error:", err.message);
    isPortOpen = false;
    notifyDisconnected();
  });

  parser.on("data", (line) => {
    try {
      const [m1, m2, m3] = line.split(",").map(Number);

      // Check if all values are valid numbers
      /*const sensorConnected = !isNaN(m1) && !isNaN(m2) && !isNaN(m3);*/
      const sensorConnected = isPortOpen;

      const voltage = computeAverage(voltageBuffer, isNaN(m1) ? 0 : m1);
      const current = computeAverage(currentBuffer, isNaN(m2) ? 0 : m2);
      const temperature = computeAverage(temperatureBuffer, isNaN(m3) ? 0 : m3);

      const data = {
        voltage,
        current,
        temperature,
        sensorConnected
      };

      io.emit("daqData", data);

      if (isRecording && csvWriter) {
        csvWriter.writeRecords([
          {
            timestamp: new Date().toISOString(),
            voltage: data.voltage,
            current: data.current,
            temperature: data.temperature
          }
        ]).catch(err => console.error("CSV write error:", err));
      }
    } catch (err) {
      console.error("Parse error:", err.message, "Line:", line);
    }
  });
}

const recordsDir = path.join(__dirname, "records");
if (!fs.existsSync(recordsDir)) {
  fs.mkdirSync(recordsDir);
}

// Start the serial connection with the default port
createPort(selectedPortPath);

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("createPort", (portPath) => {
    console.log("Reconnect request to port:", portPath);
    createPort(portPath, socket);
  });

  socket.on("toggleRecord", (shouldRecord) => {
    isRecording = shouldRecord;

    if (isRecording) {
      const filePath = path.join(recordsDir, "record_" + getTimestamp() + ".csv");

      csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: "timestamp", title: "Timestamp" },
          { id: "voltage", title: "Voltage (V)" },
          { id: "current", title: "Current (A)" },
          { id: "temperature", title: "Temperature (°C)" }
        ]
      });

      console.log("Recording started:", filePath);
    } else {
      csvWriter = null;
      socket.emit("recordStatus", { message: "Recording saved" });
      console.log("Recording stopped.");
    }
  });
});

// Start the server
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});