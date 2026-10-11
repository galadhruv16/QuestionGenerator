import net from 'node:net';

const ports = [3001, 5173];

const isPortInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

const occupiedPorts = [];
for (const port of ports) {
  if (await isPortInUse(port)) {
    occupiedPorts.push(port);
  }
}

if (occupiedPorts.length) {
  console.error(
    `GroundQ dev ports are already in use: ${occupiedPorts.join(', ')}. ` +
      'Stop the existing processes before running pnpm dev.',
  );
  process.exit(1);
}

console.log('GroundQ dev ports 3001 and 5173 are available.');
