import ejs from 'ejs'

export default function heading(template: string) {
	return (text: string) => ejs.compile(template)({ text })
}

