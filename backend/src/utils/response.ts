import { Response } from 'express';

export const ok = (res: Response, data: unknown, message = 'Success') => {
  return res.status(200).json({ message, data });
};

export const created = (res: Response, data: unknown, message = 'Created') => {
  return res.status(201).json({ message, data });
};

export const noContent = (res: Response) => {
  return res.status(204).send();
};

export const error = (res: Response, message: string, statusCode = 400) => {
  return res.status(statusCode).json({ message });
};

export const serverError = (res: Response, message = 'Internal Server Error') => {
  return res.status(500).json({ message });
};
