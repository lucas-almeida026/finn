/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{ejs,ts}"],
	theme: {
		extend: {},
	},
	plugins: [],
	safelist: [
		{
			pattern: /(bottom|top|left|right|rotate)-[0-9]+/
		},
		{
			pattern: /-?z-[0-9]+/
		}
	]
}

