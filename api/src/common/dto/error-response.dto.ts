export class ErrorResponseDto {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 400;
  declare error: 'Bad Request';
  declare message: string[];
}

export class NotFoundErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 404;
  declare error: 'Not Found';
  declare message: string;
}

export class UnauthorizedErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 401;
  declare error: 'Unauthorized';
  declare message: string;
}

export class ForbiddenErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 403;
  declare error: 'Forbidden';
  declare message: string;
}

export class ConflictErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 409;
  declare error: 'Conflict';
  declare message: string;
}

export class InternalServerErrorResponseDto extends ErrorResponseDto {
  declare statusCode: 500;
  declare error: 'Internal Server Error';
  declare message: string;
}
