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

export type Account = {
	id: string
	name: string
	balance: number
}

export type Budget = {
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

export type Transaction = IncomeTransaction | ExpenseTransaction | TransferTransaction

const OpError = {
	AlreadyExists: 'AlreadyExists',
	NotFound: 'NotFound',
	InsufficientFunds: 'InsufficientFunds'
}

export function createAccount(name: string, balance: number): Account {
	return {
		id: uuid(),
		name,
		balance
	}
}

export function createBudget(name: string, amount: number, accountId: string): Budget {
	return {
		id: uuid(),
		name,
		amount,
		accountId
	}
}

export function createTransaction(amount: number, date: string): {
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

export function createAccountController(accountRepo: Repository<Account>) {
	return {
		create: async (name: string, balance = 0) => {
			try {
				const account = createAccount(name, balance)
				await accountRepo.insertIfNotExits(account, ['name'])
				return account
			} catch (e) {
				if (e === OpError.AlreadyExists) {
					return await accountRepo.getByKey('name', name)
				}
				throw e
			}
		}
	}
}

export function createTransactionController(
	transactionRepo: Repository<Transaction>,
	accountRepo: Repository<Account>,
	budgetRepo: Repository<Budget>
) {
	return {
		income: async (amount: number, accountId: string, date?: string) => {
			try {
				const account = await accountRepo.getById(accountId)
				const transaction = createTransaction(amount, date ?? now()).income(account)
				await transactionRepo.insertIfNotExits(transaction)
				account.balance += amount
				await accountRepo.replace(account)
				return account
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
				const transaction = createTransaction(amount, date ?? now()).expense(target)
				await transactionRepo.insertIfNotExits(transaction)
				if ('balance' in target) {
					target.balance -= amount
					await accountRepo.replace(target)
				} else {
					target.amount -= amount
					await budgetRepo.replace(target)
				}
				return {
					...target,
					kind: 'accountId' in target ? 'budget' : 'account'
				}
			} catch (e) {
				throw e
			}
		},
		transfer: async (amount: number, fromId: string, toId: string, date?: string) => {
			try {
				const from = await firstResolved<Account | Budget>([
					budgetRepo.getById(fromId),
					accountRepo.getById(fromId)
				])
				const to = await firstResolved<Account | Budget>([
					budgetRepo.getById(toId),
					accountRepo.getById(toId)
				])
				const current = 'balance' in from ? from.balance : from.amount
				if (current - amount < 0) {
					throw OpError.InsufficientFunds
				}

				const transaction = createTransaction(amount, date ?? now()).transfer(from, to)
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
				return {
					from,
					to
				}
			} catch (e) {
				throw e
			}
		}
	}
}

export function createBudgetController(budgetRepo: Repository<Budget>, accountRepo: Repository<Account>) {
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

export async function initializeStorageFile<T extends { id: string }>(filename: string, reset = false) {
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
				await fs.writeFile(`./data/${filename}.json`, JSON.stringify(data))
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
				await fs.writeFile(`./data/${filename}.json`, JSON.stringify(data))
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
				await fs.writeFile(`./data/${filename}.json`, JSON.stringify(data))
				return item
			} catch (e) {
				throw e
			}
		}
	}
}

function now() {
	return new Date().toISOString()
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