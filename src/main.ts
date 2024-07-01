import fs from 'node:fs/promises'
import express from 'express'
import { Account, Budget, Transaction, createAccountController, createBudgetController, createTransactionController, initializeStorageFile } from './core'
import { z } from 'zod'
import ejs from 'ejs'

const app = express()

{
	(async () => {
		try {
			if (!(await fs.stat('./data')).isDirectory()) {
				await fs.mkdir('./data')
			}
			const tailwindcss = await fs.readFile('./src/styles/output.css', 'utf8')
			const accountRepo = await initializeStorageFile<Account>('accounts', false)
			const budgetRepo = await initializeStorageFile<Budget>('budgets', false)
			const transactionRepo = await initializeStorageFile<Transaction>('transactions', false)
			
			const accountController = createAccountController(accountRepo)
			const transactionController = createTransactionController(transactionRepo, accountRepo, budgetRepo)
			const budgetController = createBudgetController(budgetRepo, accountRepo)
			
			const baseTemplate = ejs.compile(await fs.readFile('./src/templates/base.ejs', 'utf8'))
			const indexPage = ejs.compile(await fs.readFile('./src/templates/index.ejs', 'utf8'))

			function page(title: string, body: ejs.TemplateFunction, data: any) {
				return baseTemplate({title, body: body(data), tailwindcss})
			}

			app.get('/', (req, res) => {
				res.send(page('asdf2', indexPage, {}))
			})

			app.post('/accounts', async (req, res) => {
				const accountSchema = z.object({
					name: z.string(),
					balance: z.number().optional().default(0)
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
				const budgets = budgetRepo.getAll()
				res.send(budgets)
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
						amount: z.number(),
						date: z.string().optional()
					})
	
					const parsed = transferSchema.safeParse(req.body)
					if (!parsed.success) {
						return res.status(400).send(parsed.error)
					}
					const { fromId, toId, amount, date } = parsed.data
					const result = await transactionController.transfer(amount, fromId, toId, date)
					res.send(result)
				} catch(e) {
					console.error(e)
					res.status(500).send(e)
				}
			})

			app.get('*', (_, res) => {
				res.status(404).send({error: 'not found'})
			})
			
			app.listen(2900, () => {
				console.log('API listening on port 2900!')
			})
		} catch(e) {
			console.error(e)
		}
	})()
}