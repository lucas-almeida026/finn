import fs from 'node:fs/promises';
import express from 'express';
import { z } from 'zod';
import cors from 'cors'
import {
    Account,
    Budget,
    Transaction,
    createAccountController,
    createBudgetController,
    createTransactionController,
    initializeStorageFile
} from '../core';

export function startAPI() {
    return new Promise(async (resolve, reject) => {
        try {
            const app = express()
			app.use(cors({ origin: '*' }))
			app.use(express.json())
            if (!(await fs.stat('./data')).isDirectory()) {
                await fs.mkdir('./data')
            }
            const accountRepo = await initializeStorageFile<Account>('accounts', false)
            const budgetRepo = await initializeStorageFile<Budget>('budgets', false)
            const transactionRepo = await initializeStorageFile<Transaction>('transactions', false)

            const accountController = createAccountController(accountRepo)
            const transactionController = createTransactionController(transactionRepo, accountRepo, budgetRepo)
            const budgetController = createBudgetController(budgetRepo, accountRepo)

            app.get('/', (req, res) => {
                res.send({ version: '0.0.1' })
            })

            app.post('/accounts', async (req, res) => {
                const accountSchema = z.object({
                    name: z.string(),
                    balance: z.string().transform(x => parseInt(x) || 0).optional()
                })

                const parsed = accountSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).send(parsed.error)
                }
                const { name, balance } = parsed.data
                const account = await accountController.create(name, balance)
                res.send(account)
            })

            app.get('/accounts', (req, res) => {
                const accounts = accountRepo.getAll()
                res.send(accounts)
            })

            app.post('/budgets', async (req, res) => {
                const budgetSchema = z.object({
                    name: z.string(),
                    accountId: z.string(),
                })

                const parsed = budgetSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).send(parsed.error)
                }
                const { name, accountId } = parsed.data
                const budget = await budgetController.create(name, accountId)
                res.send(budget)
            })

            app.get('/budgets', (req, res) => {
				const { accountId } = req.query
				if (!accountId) {
					return res.status(400).send('accountId is required')
				}
                const budgets = budgetRepo.getAll()
                res.send(budgets.filter(x => x.accountId === accountId))
            })

            app.post('/income', async (req, res) => {
                const incomeSchema = z.object({
                    amount: z.number(),
                    accountId: z.string(),
                    date: z.string().optional()
                })

                const parsed = incomeSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).send(parsed.error)
                }
                const { amount, accountId, date } = parsed.data
                const account = await transactionController.income(amount, accountId, date)
                res.send(account)
            })

            app.post('/expense', async (req, res) => {
                const expenseSchema = z.object({
                    amount: z.number(),
                    targetId: z.string(),
                    date: z.string().optional()
                })

                const parsed = expenseSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).send(parsed.error)
                }
                const { amount, targetId, date } = parsed.data
                const account = await transactionController.expense(amount, targetId, date)
                res.send(account)
            })

            app.post('/transfer', async (req, res) => {
                try {
                    const transferSchema = z.object({
                        fromId: z.string(),
                        toId: z.string(),
                        amount: z.string().transform(x => parseInt(x) || 0),
                        date: z.string().optional()
                    })

                    const parsed = transferSchema.safeParse(req.body)
                    if (!parsed.success) {
                        return res.status(400).send(parsed.error)
                    }
                    const { fromId, toId, amount, date } = parsed.data
                    const result = await transactionController.transfer(amount, fromId, toId, date)
                    res.send(result)
                } catch (e) {
                    console.error(e)
                    res.status(500).send(e)
                }
            })

            app.get('*', (_, res) => {
                res.status(404).send({ error: 'not found' })
            })

            app.listen(2901, () => resolve(2901))
        } catch (e) {
            reject(e)
        }
    })
}