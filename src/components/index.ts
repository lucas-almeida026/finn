import fs from 'node:fs/promises'
import heading1 from './heading1';
import vstack from './vstack'

export const getComponents = async () => {
	return {
		heading1: heading1(await fs.readFile('./src/components/heading1.ejs', 'utf8')),
		vstack: vstack(await fs.readFile('./src/components/vstack.ejs', 'utf8'))
	}
}