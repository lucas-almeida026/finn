import ejs from 'ejs'

type Justify = 'normal' | 'start' | 'end' | 'between' | 'evenly' | 'center' | 'stretch'
type Align = 'start' | 'end' | 'center' | 'baseline' | 'stretch'

export default function vstack(template: string) {
	const defaultParams: {justify?: Justify, align?: Align}  = {
		justify: 'start',
		align: 'start'
	}
	return ({justify, align} = defaultParams, ...children: string[]) => ejs.compile(template)({ children: children.join('\n'), justify, align })
}
