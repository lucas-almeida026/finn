const btnTransact = document.getElementById('btn-transact');
const btnIncome = document.getElementById('btn-income');
const btnExpense = document.getElementById('btn-expense');
const btnTransfer = document.getElementById('btn-transfer');
const floatingMenu = document.getElementById('floating-menu');
const formTransfer = document.getElementById('form-transfer');
const formExpense = document.getElementById('form-expense');
const btnNewBudget = document.getElementById('btn-new-budget');
const budgetList = document.getElementById('budget-list');
const bgForm = document.getElementById('bg-form');

const showForm = reactive(null)
const showButtons = reactive(false)

let floatingMenuOpen = false;
let formTransferVisible = false;
let formExpenseVisible = false;
const queryParams = new URLSearchParams(window.location.search);

btnTransact.addEventListener('click', () => {
	showButtons.value = !showButtons.value
	if (!showButtons.value) {
		hideFormFn()
	}
})


function showFormFn(form) {
	form.classList.replace('hidden', 'flex')
	showForm.value = form
	bgForm.appendChild(form)
	form.classList.remove('hidden')
	bgForm.classList.replace('-z-10', 'z-10')
	bgForm.classList.replace('opacity-0', 'opacity-100')
}

function replaceFormFn(form) {
	const currentForm = showForm.value
	if (currentForm !== null) {
		currentForm.classList.replace('flex', 'hidden')
		bgForm.removeChild(currentForm)
		form.classList.replace('hidden', 'flex')
		showForm.value = form
		bgForm.appendChild(form)
	}
}

function hideFormFn() {
	const form = showForm.value
	if (form !== null) {
		form.classList.replace('flex', 'hidden')
		bgForm.removeChild(form)
		showForm.value = null
		bgForm.classList.replace('z-10', '-z-10')
		bgForm.classList.replace('opacity-100', 'opacity-0')
	}	
}

showButtons.subscribe(value => {
	if (value) {
		btnTransact.classList.add('rotate-45')
		btnExpense.classList.replace('-z-10', 'z-20')
		btnExpense.classList.replace('bottom-5', 'bottom-28')
		btnTransfer.classList.replace('-z-10', 'z-20')
		btnTransfer.classList.replace('right-5', 'right-20')
		btnTransfer.classList.replace('bottom-5', 'bottom-20')
		btnIncome.classList.replace('-z-10', 'z-20')
		btnIncome.classList.replace('right-5', 'right-28')
	} else {
		btnTransact.classList.remove('rotate-45')
		btnExpense.classList.replace('z-20', '-z-10')
		btnExpense.classList.replace('bottom-28', 'bottom-5')
		btnTransfer.classList.replace('z-20', '-z-10')
		btnTransfer.classList.replace('right-20', 'right-5')
		btnTransfer.classList.replace('bottom-20', 'bottom-5')
		btnIncome.classList.replace('z-20', '-z-10')
		btnIncome.classList.replace('right-28', 'right-5')
	}
})

btnIncome.addEventListener('click', () => {
	const amountStr = prompt('Enter amount in cents: ')
	if (amountStr === null || amountStr === '') return showButtons.value = false
	try {
		const amount = parseInt(amountStr)
		if (isNaN(amount)) throw 'Invalid amount'
		const accountId = queryParams.get('accountId')
		if (!accountId) throw 'Invalid accountId'
		fetch('http://localhost:2901/income', {
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				amount,
				accountId
			})
		})
		.then(res => res.json())
		.then(() => window.location.reload())
		.catch(err => {
			alert('could not create transaction')
			console.error(err)
		})
	} catch (e) {
		console.error(e)
		alert('Invalid amount')
	}
})

btnExpense.addEventListener('click', () => {
	if (showForm.value === null) {
		showFormFn(formExpense)
	} else if (showForm.value === formTransfer) {
		replaceFormFn(formExpense)
	} else {
		hideFormFn()
		showButtons.value = false
	}
})

btnTransfer.addEventListener('click', () => {
	if (showForm.value === null) {
		showFormFn(formTransfer)
	} else if (showForm.value === formExpense) {
		replaceFormFn(formTransfer)
	} else {
		hideFormFn()
		showButtons.value = false
	}
})

btnNewBudget.addEventListener('click', async () => {
	try {
		const accountId = queryParams.get('accountId')
		if (!accountId) throw 'Invalid accountId'
		const name = prompt('Enter budget name: ')
		await fetch('http://localhost:2901/budgets', {
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name,
				accountId
			})
		}).then(res => res.json())
		window.location.reload()
	} catch (e) {
		console.error(e)
		alert('Could not create budget')
	}
})

$notifications.subscribe('resetForm', () => {
	const currentForm = showForm.value
	if (currentForm !== null) {
		const inputs = currentForm.getElementsByTagName('input')
		for (const input of inputs) {
			input.value = ''
		}
	}
})

$notifications.subscribe('closeForm', () => {
	hideFormFn()
	showButtons.value = false
})