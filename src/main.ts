import fs from 'node:fs/promises'
import express from 'express'
import { startAPI } from './api'
import axios from 'axios'
import ejs from 'ejs'
import { Account } from './core'

const app = express();
app.use(express.json());
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
			}
		}
	})()

	const tailwindcss = await fs.readFile('./src/styles/output.css', 'utf8')
	const baseTemplate = ejs.compile(await fs.readFile('./src/templates/base.ejs', 'utf8'))
	const indexPage = ejs.compile(await fs.readFile('./src/templates/index.ejs', 'utf8'))
	const createAccPage = ejs.compile(await fs.readFile('./src/templates/create-account.ejs', 'utf8'))

	function page(title: string, body: ejs.TemplateFunction, data: any) {
		return baseTemplate({ title, body: body(data), tailwindcss })
	}

	function redirect(url: string) {
		return baseTemplate({ title: '', body: `<div hx-get="${url}" hx-replace-url="${url}" hx-trigger="load" hx-target="body"></div>`, tailwindcss})
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
		if (!account) {
			console.log('Account not found')
			return res.send(redirect('/account/create'))
		}
		return res.send(page('Home', indexPage, { account }))
	})

	app.get('/account-list', async (req, res) => {
		return setTimeout(() => res.send('<p>accounts list</p>'), 1000)
	})

	app.get('/account/create', async (req, res) => {
		const has = (await api.accounts.list()).data.length > 0
		return res.send(page('Create Account', createAccPage, {defaultName: has ? '' : 'main'}))
	})

	app.post('/account/create', async (req, res) => {
		api.accounts.create(req.body)
		.then(({data: created}) => {
			res.status(200).send(redirect(`/?accountId=${created.id}`))
		})
		.catch(({response: {data: err}}) => {
			console.log(err)
			res.status(500).send('')
		})

	})

	app.listen(2900, () => console.log('Client started on port 2900'))
})().catch(console.error)