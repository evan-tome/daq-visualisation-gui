# EV Data Monitor

A **web-based interface** for real-time monitoring and visualization of electric vehicle (EV) data, developed during an internship at the International Hellenic University.  
This project reads **voltage**, **current**, and **temperature** data from an EV via a serial port, displays it on a web dashboard, and optionally records it to CSV files.

---

## Features

1. Real-time data streaming from an EV using **serial communication**  
2. Smooth data averaging for voltage, current, and temperature  
3. Web-based interface with live updates using **Socket.IO**  
4. Optional recording of data to **CSV files**  
5. Automatic handling of sensor disconnection and reconnection  

---

## Technologies Used

1. **Node.js** with Express for the server  
2. **Socket.IO** for real-time data updates  
3. **SerialPort** for reading EV data via serial connection  
4. **csv-writer** for saving recorded data  
5. **HTML/CSS/JS** for the web dashboard (located in `public/` folder)  

---

## Prerequisites

- [Node.js](https://nodejs.org/)  
- A serial device sending comma-separated EV data: voltage,current,temperature

---

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ev-data-monitor.git
cd ev-data-monitor
```

2. Install dependencies:
```bash
npm install express socket.io serialport @serialport/parser-readline csv-writer
```

3. Connect your EV or device to a serial port (default is COM3).

4. Start the server:
```bash
node index.js
```

5. Open your browser and navigate to:
http://localhost:3000

