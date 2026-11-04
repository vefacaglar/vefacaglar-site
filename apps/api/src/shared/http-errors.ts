export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    // Supply a fixed log message whenever the client message contains interpolated data.
    public readonly logMessage = message,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized.", logMessage = message, options?: ErrorOptions) {
    super(401, message, logMessage, options);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden.") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict.") {
    super(409, message);
  }
}
