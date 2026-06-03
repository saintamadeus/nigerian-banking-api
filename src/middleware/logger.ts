import morgan from 'morgan';
import { Request } from 'express';

morgan.token('user-id', (req: Request) => {
  return (req as any).user?.userId || 'unauthenticated';
});

const logger = morgan(':method :url :status :response-time ms - user: :user-id');

export default logger;