import { z } from 'zod'

export const farmSchema = z.object({
  name: z.string().min(1, 'Farm name is required'),
  acreage: z.coerce.number().positive('Acreage must be greater than 0'),
})

export const workerSchema = z.object({
  name: z.string().min(1, 'Worker name is required'),
  phone: z.string().optional().or(z.literal('')),
  monthly_salary: z.coerce.number().positive('Salary must be greater than 0'),
})
