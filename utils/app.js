const io = require("socket.io");
const express = require("express");
const usage = require("usage");
const http = require("http");
const app = express();
const server = http.createServer(app);
const sio = io(server);
const Users = require("../models/user");
const nconf = require("nconf");

const config = require(nconf.get("conf"));

const dev_key =
  Math.random()
    .toString(36)
    .substring(2, 15) +
  Math.random()
    .toString(36)
    .substring(2, 15);

console.log("Admin console ready for connection on port 4206");
console.log("Developer key: " + dev_key);

sio.on("connection", function(socket) {
  socket.tries = 0;
  socket.authenticated = false;
  socket.visitors = false;
  socket.on("password", function(password) {
    if (socket.tries > 4) {
      return socket.emit("wrong_password", socket.tries);
    }
    if (password == dev_key) {
      socket.authenticated = true;
      socket.emit("correct_password", password, config);
    } else {
      socket.tries++;
      socket.emit("wrong_password", socket.tries);
    }
  });
  socket.on("stats", function() {
    const Analytics = require("../models/analytics");
    if (!socket.authenticated) return;
    if (!socket.visitors) {
      Analytics.data(function(keys, db) {
        let database = { online: db.connection.readyState };
        switch (db.connection.readyState) {
          case 0:
            database.msg = "Disconnected";
            break;
          case 1:
            database.msg = "Connected";
            break;
          case 2:
            database.msg = "Connecting";
            break;
          case 3:
            database.msg = "Disconnecting";
            break;
        }
        database.data = keys;
        socket.emit("database", database);
      });
      Analytics.find(function(err, docs) {
        socket.emit("server_analytics", docs);
      });
      socket.visitors = true;
    }
    socket.emit(
      "sockets",
      Object.entries(require("./socket").sockets.connected).length
    );
    usage.lookup(process.pid, function(err, result) {
      if (err) return;
      socket.emit("cpu", result.cpu);
      socket.emit("ram", Math.round(result.memory * 0.000001));
    });
  });
  socket.on("shutdown", function() {
    if (!socket.authenticated) return;
    return process.exit(0);
  });
});

server.listen("4206");
