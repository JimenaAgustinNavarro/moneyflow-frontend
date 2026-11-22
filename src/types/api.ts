export interface GatewayHealthResponse {
  status: 'ok';
  gateway: 'up';
  coreService: 'up';
  database: 'up';
  timestamp: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}
