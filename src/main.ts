import fs from 'node:fs/promises'
import { v4 as uuid } from 'uuid'

type Repository<T extends { id: string }> = {
	getById: (id: string) => Promise<T>
	getByKey: (key: keyof T, val: string) => Promise<T>
	getAll: () => T[]
	insertIfNotExits: (item: T, keys?: (keyof T)[]) => Promise<T>
	replace: (item: T) => Promise<T>
	deleteById: (id: string) => Promise<T>
}

type Account = {
	id: string
	name: string
	balance: number
}

type Budget = {
	id: string
	accountId: string
	name: string
	amount: number
}

type TransactionBase = {
	id: string
	amount: number
	date: string
}

type IncomeTransaction = TransactionBase & {
	kind: 'income'
	accountId: string
}

type ExpenseTransaction = TransactionBase & {
	kind: 'expense'
	target: {
		kind: 'account' | 'budget'
		id: string
	}
}

type TransferTransaction = TransactionBase & {
	kind: 'transfer'
	from: {
		kind: 'account' | 'budget'
		id: string
	}
	to: {
		kind: 'account' | 'budget'
		id: string
	}
}

type Transaction = IncomeTransaction | ExpenseTransaction | TransferTransaction

const OpError = {
	AlreadyExists: 'AlreadyExists',
	NotFound: 'NotFound',
	InsufficientFunds: 'InsufficientFunds'
}

if (!(await fs.exists('./data'))) {
	await fs.mkdir('./data')
}
const accountRepo = await initializeStorageFile<Account>('accounts', true)
const budgetRepo = await initializeStorageFile<Budget>('budgets', true)
const transactionRepo = await initializeStorageFile<Transaction>('transactions', true)

const accountController = createAccountController(accountRepo)
const transactionController = createTransactionController(transactionRepo, accountRepo, budgetRepo)
const budgetController = createBudgetController(budgetRepo, accountRepo)

const acc1 = await accountController.create('acc1')
await transactionController.income(1800_00, acc1.id)
const mercado = await budgetController.create('mercado', acc1.id)
await transactionController.transfer(300_00, acc1, mercado)

function createAccount(name: string, balance: number): Account {
	return {
		id: uuid(),
		name,
		balance
	}
}

function createBudget(name: string, amount: number, accountId: string): Budget {
	return {
		id: uuid(),
		name,
		amount,
		accountId
	}
}

function createTransaction(amount: number, date: string): {
	income: (account: Account) => IncomeTransaction
	expense: (account: Account | Budget) => ExpenseTransaction
	transfer: (from: Account | Budget, to: Account | Budget) => TransferTransaction
} {
	return {
		income: (account) => ({
			kind: 'income',
			id: uuid(),
			accountId: account.id,
			date,
			amount,
		}),
		expense: (account) => ({
			kind: 'expense',
			id: uuid(),
			target: {
				kind: 'account',
				id: account.id
			},
			date,
			amount,
		}),
		transfer: (from, to) => ({
			id: uuid(),
			from: {
				kind: 'accountId' in from ? 'budget' : 'account',
				id: from.id
			},
			to: {
				kind: 'accountId' in to ? 'budget' : 'account',
				id: to.id
			},
			date,
			amount,
			kind: 'transfer'
		})
	}
}

function createAccountController(accountRepo: Repository<Account>) {
	return {
		create: async (name: string, balance = 0) => {
			try {
				const account = createAccount(name, balance)
				await accountRepo.insertIfNotExits(account, ['name'])
				console.log(`Account "${name}" was created successfully`)
				return account
			} catch (e) {
				if (e === OpError.AlreadyExists) {
					console.log(`Account "${name}" already exists`)
					return await accountRepo.getByKey('name', name)
				}
				throw e
			}
		}
	}
}

function createTransactionController(
	transactionRepo: Repository<Transaction>,
	accountRepo: Repository<Account>,
	budgetRepo: Repository<Budget>
) {
	return {
		income: async (amount: number, accountId: string, date?: string) => {
			try {
				const account = await accountRepo.getById(accountId)
				const transaction = createTransaction(amount, date ?? today()).income(account)
				await transactionRepo.insertIfNotExits(transaction)
				account.balance += amount
				await accountRepo.replace(account)
				console.log(`Income of ${(amount / 100).toFixed(2)} successfully computed`)
			} catch (e) {
				throw e
			}
		},
		expense: async (amount: number, targetId: string, date?: string) => {
			try {
				const target = await firstResolved<Account | Budget>([
					accountRepo.getById(targetId),
					budgetRepo.getById(targetId)
				])
				const transaction = createTransaction(amount, date ?? today()).expense(target)
				await transactionRepo.insertIfNotExits(transaction)
				if ('balance' in target) {
					target.balance -= amount
					await accountRepo.replace(target)
				} else {
					target.amount -= amount
					await budgetRepo.replace(target)
				}
				console.log(`Expense of ${(amount / 100).toFixed(2)} successfully computed`)
			} catch (e) {
				throw e
			}
		},
		transfer: async (amount: number, _from: Account | Budget, _to: Account | Budget, date?: string) => {
			try {
				const from = await (
					'accountId' in _from
						? budgetRepo.getById(_from.id)
						: accountRepo.getById(_from.id)
				)
				const to = await (
					'accountId' in _to
						? budgetRepo.getById(_to.id)
						: accountRepo.getById(_to.id)
				)
				const current = 'balance' in from ? from.balance : from.amount
				if (current - amount < 0) {
					throw OpError.InsufficientFunds
				}

				const transaction = createTransaction(amount, date ?? today()).transfer(from, to)
				await transactionRepo.insertIfNotExits(transaction)
				if ('accountId' in from) {
					from.amount -= amount
					await budgetRepo.replace(from)
				} else {
					from.balance -= amount
					await accountRepo.replace(from)
				}
				if ('accountId' in to) {
					to.amount += amount
					await budgetRepo.replace(to)
				} else {
					to.balance += amount
					await accountRepo.replace(to)
				}
			} catch (e) {
				throw e
			}
		}
	}
}

function createBudgetController(budgetRepo: Repository<Budget>, accountRepo: Repository<Account>) {
	return {
		create: async (name: string, accountId: string, amount = 0) => {
			try {
				const account = await accountRepo.getById(accountId)
				const budget = createBudget(name, amount, account.id)
				await budgetRepo.insertIfNotExits(budget, ['name'])
				return budget
			} catch (e) {
				throw e
			}
		}
	}
}

async function initializeStorageFile<T extends { id: string }>(filename: string, reset = false) {
	try {
		const data = JSON.parse(await fs.readFile(`./data/${filename}.json`, 'utf8'))
		return createFileRepository<T>(filename, reset ? [] : data)
	} catch (e) {
		console.log(`creating ${filename} file...`)
		try {
			await fs.writeFile(`./data/${filename}.json`, JSON.stringify([]))
			console.log(`${filename} file created`)
			return createFileRepository<T>(filename, [])
		} catch (e2) {
			throw new Error(`Could not create ${filename} file\n`)
		}
	}
}

function createFileRepository<T extends { id: string }>(filename: string, data: T[]): Repository<T> {
	return {
		getById: async (id: string) => {
			const index = data.findIndex(e => e.id === id)
			if (index === -1) {
				throw OpError.NotFound
			}
			return data[index]
		},
		getByKey: async (key: keyof T, val: string) => {
			const index = data.findIndex(e => e[key] === val)
			if (index === -1) {
				throw OpError.NotFound
			}
			return data[index]
		},
		getAll: () => data,
		insertIfNotExits: async (item: T, keys = []) => {
			try {
				const index = data.findIndex(e => e.id === item.id || keys.some(k => e[k] === item[k]))
				if (index !== -1) {
					throw OpError.AlreadyExists
				}
				data.push(item)
				await fs.writeFile(`./${filename}.json`, JSON.stringify(data))
				return item
			} catch (e) {
				throw e
			}
		},
		replace: async (item: T) => {
			try {
				const index = data.findIndex(e => e.id === item.id)
				if (index === -1) {
					throw OpError.NotFound
				}
				data = [...data.slice(0, index), item, ...data.slice(index + 1)]
				await fs.writeFile(`./${filename}.json`, JSON.stringify(data))
				return item
			} catch (e) {
				throw e
			}
		},
		deleteById: async (id: string) => {
			try {
				const index = data.findIndex(e => e.id === id)
				if (index === -1) {
					throw OpError.NotFound
				}
				const item = data[index]
				data = [...data.slice(0, index), ...data.slice(index + 1)]
				await fs.writeFile(`./${filename}.json`, JSON.stringify(data))
				return item
			} catch (e) {
				throw e
			}
		}
	}
}

function today() {
	return new Date().toISOString().split('T')[0]
}

async function firstResolved<T>(promises: Promise<T>[]): Promise<T> {
	return new Promise((resolve, reject) => {
		let rejectedCount = 0
		const totalPromises = promises.length

		promises.forEach(promise => {
			promise.then(resolve).catch(() => {
				rejectedCount++
				if (rejectedCount === totalPromises) {
					reject(new Error('All promises were rejected'))
				}
			})
		})
	})
}