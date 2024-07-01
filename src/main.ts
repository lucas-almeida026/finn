import fs from 'node:fs/promises'
import express from 'express'
import { startAPI } from './api'
import axios from 'axios'
import ejs from 'ejs';

const app = express();

(async () => {
	const port = await startAPI()
	console.log(`API started on port ${port}`)
	const api = axios.create({
		baseURL: `http://localhost:${port}`
	})
	
	const tailwindcss = await fs.readFile('./src/styles/output.css', 'utf8')
	const baseTemplate = ejs.compile(await fs.readFile('./src/templates/base.ejs', 'utf8'))
	const indexPage = ejs.compile(await fs.readFile('./src/templates/index.ejs', 'utf8'))

	function page(title: string, body: ejs.TemplateFunction, data: any) {
		return baseTemplate({title, body: body(data), tailwindcss})
	}

	app.get('/', async (req, res) => {
		return res.send(page('Home', indexPage, {}))
	})

	app.listen(2900, () => console.log('Client started on port 2900'))
})().catch(console.error)