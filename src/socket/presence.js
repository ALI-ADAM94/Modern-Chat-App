// تتبع المستخدمين المتصلين
// Tracks who is online. A user can have several tabs/devices open, so we count
// sockets per user and only treat them as offline when the last one disconnects.
const connections = new Map(); // userId -> number of open sockets

function addConnection(userId) {
  const count = (connections.get(userId) || 0) + 1;
  connections.set(userId, count);
  return count === 1; // true = the user just came online
}

function removeConnection(userId) {
  const count = (connections.get(userId) || 0) - 1;
  if (count <= 0) {
    connections.delete(userId);
    return true; // true = the user just went offline
  }
  connections.set(userId, count);
  return false;
}

function isOnline(userId) {
  return connections.has(String(userId));
}

function onlineUserIds() {
  return [...connections.keys()];
}

module.exports = { addConnection, removeConnection, isOnline, onlineUserIds };
