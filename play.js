import {getarabic, getelapsed, getayah, gettotalayah} from './util.js'
import path from 'node:path'
import fs from 'fs-extra'
import enquirer from 'enquirer'
import {playAudioFile} from 'audic'
import glob from 'glob'
import util from 'node:util'

const out = './correct'
const log = console.log
const prompt = enquirer.prompt
const pglob = util.promisify(glob)

let {surah} = await prompt({message: "surah", name: "surah", type: "text", initial: 1})
surah = parseInt(surah)
let {ayahbegin} = await prompt({message: "begining from ayah", name: "ayahbegin", type: "text", initial: 1})
ayahbegin = parseInt(ayahbegin)
const lastayah = await gettotalayah(surah)
let {ayahend} = await prompt({message: 'up to ayah', name: 'ayahend', type: 'text', initial: lastayah})
ayahend = parseInt(ayahend)

const files = await pglob(out + '/surah-' + surah + '-*.*')
const db = []
for (const file of files) {
	const {name: fname} = path.parse(file)
	const ayah = parseInt(fname.split('-')[2])
	if (ayah < ayahbegin) continue
	if (ayah > ayahend) break

	const arabic = await getarabic(surah, ayah)
	const text = await getayah(surah, ayah)
	db.push({text, arabic, file, surah, ayah})
}

log('\n')
for (const audio of db) {
	log(audio.arabic)
	log('\n')
	log(audio.text)
	await playAudioFile(audio.file)
	log('\n\n')
}
