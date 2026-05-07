import { Response } from 'express';

interface SSEConnection {
  userId: string;
  res: Response;
}

class SSEManager {
  private connections: SSEConnection[] = [];

  addConnection(userId: string, res: Response) {
    this.connections.push({ userId, res });
    
    // Remove connection on close
    res.on('close', () => {
      this.connections = this.connections.filter(c => c.res !== res);
    });
  }

  sendToUser(userId: string, data: any) {
    const userConnections = this.connections.filter(c => c.userId === userId);
    userConnections.forEach(c => {
      c.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }

  broadcast(data: any) {
    this.connections.forEach(c => {
      c.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
}

export const sseManager = new SSEManager();
