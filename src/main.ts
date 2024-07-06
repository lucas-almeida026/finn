import fs from 'node:fs/promises'
import express from 'express'
import { startAPI } from './api'
import axios from 'axios'
import ejs from 'ejs'
import { Account, Budget } from './core'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

(async () => {
	const port = await startAPI()
	console.log(`API started on port ${port}`)
	const api = (() => {
		const client = axios.create({
			baseURL: `http://localhost:${port}`
		})
		return {
			accounts: {
				list: () => client.get<Account[]>('/accounts'),
				create: (data: any) => client.post<Account>('/accounts', data)
			},
			transfer: (data: any) => client.post<{ from: Account, to: Account }>('/transfer', data),
			budgets: {
				list: (accountId: string) => client.get<Budget[]>('/budgets', {
					params: accountId ? { accountId } : {}
				}),
				create: (data: any) => client.post<Budget>('/budgets', data)
			},
			expense: (amount: number, targetId: string, data?: string) => client.post('/expense', { amount, targetId, data })
		}
	})()

	const tailwindcss = await fs.readFile('./src/styles/output.css', 'utf8')
	const floatingBtnJs = await fs.readFile('./src/scripts/floatingBtn.js', 'utf8')
	const baseTemplate = ejs.compile(await fs.readFile('./src/templates/base.ejs', 'utf8'))
	const indexPage = ejs.compile(await fs.readFile('./src/templates/index.ejs', 'utf8'))
	const createAccPage = ejs.compile(await fs.readFile('./src/templates/create-account.ejs', 'utf8'))

	function page(title: string, body: ejs.TemplateFunction, data: any, script = '0;') {
		return baseTemplate({ title, body: body(data), tailwindcss, script })
	}

	const HomePage = (data: any) => page('Home', indexPage, data, floatingBtnJs)

	function redirect(url: string, script = '0;') {
		return baseTemplate({ title: '', body: `<div hx-get="${url}" hx-replace-url="${url}" hx-trigger="load" hx-target="body"></div>`, tailwindcss, script })
	}

	app.get('/', async (req, res) => {
		const { accountId } = req.query
		const { data: accounts } = await api.accounts.list()
		if (!accountId) {
			const [account] = accounts
			if (!account) {
				console.log('Account not found')
				return res.send(redirect('/account/create'))
			}
			return res.send(redirect(`/?accountId=${account.id}`))
		}
		const account = accounts.find((x: any) => x.id === accountId)
		const { data: budgets } = await api.budgets.list(String(accountId))
		if (!account) {
			console.log('Account not found')
			return res.send(redirect('/account/create'))
		}
		return res.send(HomePage({ accounts, account, budgets }))
	})

	app.get('/account-list', async (req, res) => {
		return setTimeout(() => res.send('<p>accounts list</p>'), 1000)
	})

	app.get('/account/create', async (req, res) => {
		const has = (await api.accounts.list()).data.length > 0
		return res.send(page('Create Account', createAccPage, { defaultName: has ? '' : 'main' }))
	})

	app.post('/account/create', async (req, res) => {
		api.accounts.create(req.body)
			.then(({ data: created }) => {
				res.status(200).send(redirect(`/?accountId=${created.id}`))
			})
			.catch((err) => {
				console.log(err?.data?.message ?? err?.data ?? err)
				res.status(500).send('')
			})

	})

	app.post('/transfer', async (req, res) => {
		try {
			const { data: result } = await api.transfer(req.body)
			res.setHeader('HX-Refresh', 'true')
			res.send('')
		} catch (e: any) {
			console.error(e?.response?.data?.message ?? e?.response?.data ?? e)
			res.status(500).send('')
		}
	})

	app.post('/expense', async (req, res) => {
		const { amount, target } = req.body
		if (!amount || !target) {
			return res.status(400).send('')
		}
		try {
			const { data: result } = await api.expense(amount, target)
			if (result.kind === 'account') {
				res.setHeader('HX-Retarget', '#account-balance')
				res.setHeader('HX-Reswap', 'innerHTML')
				res.send(`Balance: R$${(result.balance / 100).toFixed(2)}`)
			} else {
				res.setHeader('HX-Retarget', `#bgt-${result.id}-balance`)
				res.setHeader('HX-Reswap', 'innerHTML')
				res.send(`R$${(result.amount / 100).toFixed(2)}`)
			}
		} catch (e: any) {
			console.log(e?.response?.data?.message ?? e?.response?.data ?? e)
			res.status(500).send('')
		}
	})

	app.listen(2900, () => console.log('Client started on port 2900'))
})().catch(console.error)