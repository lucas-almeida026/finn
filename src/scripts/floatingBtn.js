const btnTransact = document.getElementById('btn-transact');
const btnIncome = document.getElementById('btn-income');
const btnExpense = document.getElementById('btn-expense');
const btnTransfer = document.getElementById('btn-transfer');
const floatingMenu = document.getElementById('floating-menu');
const formTransfer = document.getElementById('form-transfer');

let floatingMenuOpen = false;
let formTransferVisible = false;
const queryParams = new URLSearchParams(window.location.search);

btnTransact.addEventListener('click', () => {
	floatingMenuOpen = !floatingMenuOpen;
	floatingMenu.classList.toggle('hidden')
	if (formTransferVisible) {
		formTransferVisible = false;
		formTransfer.classList.add('hidden')
	}
})

btnIncome.addEventListener('click', () => {
	const amountStr = prompt('Enter amount in cents: ')
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
		}).then(res => res.json())
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
	const amountStr = prompt('Enter amount in cents: ')
	try {
		const amount = parseInt(amountStr)
		if (isNaN(amount)) throw 'Invalid amount'
		const accountId = queryParams.get('accountId')
		if (!accountId) throw 'Invalid accountId'
		fetch('http://localhost:2901/expense', {
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				amount,
				targetId: accountId
			})
		}).then(res => res.json())
		.then(() => window.location.reload())
		.catch(err => {
			alert('could not create transaction')
			console.error(err)
		})
	} catch(e) {
		console.error(e)
		alert('Invalid amount')
	}
})

btnTransfer.addEventListener('click', () => {
	formTransferVisible = !formTransferVisible
	formTransfer.classList.toggle('hidden')
	floatingMenuOpen = false;
	floatingMenu.classList.add('hidden')
})