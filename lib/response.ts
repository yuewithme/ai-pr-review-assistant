import type { ApiResponse } from "../types/api.ts";

export function successResponse<T>(data: T, init?: ResponseInit): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  return Response.json(body, {
    status: 200,
    ...init,
  });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return Response.json(body, { status });
}

