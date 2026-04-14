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

const installmentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  due_date: z.string().min(1, 'Due date is required'),
})

export const activitySchema = z.object({
  type: z.enum(['spray', 'water', 'fertilize', 'harvest']),
  farm_id: z.string().uuid('Select a farm'),
  activity_date: z.string().min(1, 'Date is required'),
  item_name: z.string().optional().or(z.literal('')),
  meter_reading: z.coerce.number().optional(),
  boxes_collected: z.coerce.number().int().min(0).optional(),
  description: z.string().optional().or(z.literal('')),
})

export const expenseSchema = z.object({
  category: z.enum(['electricity', 'spray', 'fertilizer', 'labor', 'misc']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expense_date: z.string().min(1, 'Date is required'),
  farm_id: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  linked_activity_id: z.string().optional().or(z.literal('')),
})

export const seasonCreateSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  contractor_name: z.string().min(1, 'Contractor name is required'),
  contractor_phone: z.string().optional().or(z.literal('')),
  contractor_cnic: z.string().optional().or(z.literal('')),
  predetermined_amount: z.coerce.number().positive('Amount must be greater than 0'),
  spray_landlord_pct: z.coerce.number().int().min(0).max(100),
  fertilizer_landlord_pct: z.coerce.number().int().min(0).max(100),
  agreed_boxes: z.coerce.number().int().min(0),
  farm_ids: z.array(z.string().uuid()).min(1, 'Select at least one farm'),
  installments: z.array(installmentSchema).min(1, 'At least one installment is required'),
})
