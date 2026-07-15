import { io } from 'socket.io-client';

// One shared socket for the whole app. Notifications land instantly on the
// `notification` event; the bell's 45s poll stays as a safety net for anyone
// whose connection dropped.
let socket = null;

const serverUrl = () => {
  const api = import.meta.env.VITE_API_URL;
  return api ? new URL(api).origin : window.location.origin;
};

export const connectSocket = (token) => {
  if (!token) return null;
  if (socket?.connected && socket.auth?.token === token) return socket;

  disconnectSocket();
  socket = io(serverUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
