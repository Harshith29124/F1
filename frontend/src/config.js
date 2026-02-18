const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default {
    backendUrl,
    wsUrl
};
