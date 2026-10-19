export interface FieldError {
  field: string;
  message: string;
}

// Throw this from a service to send a specific status code and message to the client.
// The central error handler turns it into: { status: 'error', message, errors? }
export class HttpError extends Error {
  status: number;
  errors?: FieldError[];

  constructor(status: number, message: string, errors?: FieldError[]) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errors = errors;
  }
}
