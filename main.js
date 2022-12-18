import enquirer from 'enquirer'
import os from 'node:os'
import fs from 'fs-extra'
import Audic from 'audic'
import process from 'node:process'
import keypress from 'keypress'
import mp3 from 'mp3-cutter'
import path from 'node:path'

const log = console.log
const _log = process.stdout.write
const prompt = enquirer.prompt

const _return = await main()
if (_return) log(_return)

async function main() {
	let {audiofile} = await prompt({message: "audio file", name: "audiofile", type: "text"})
	audiofile = audiofile.trim()
	if (audiofile[0] == '~') {
		audiofile = os.homedir() + audiofile.slice(1)
	}
	const isvalidfile = await fs.access(audiofile).then(_ => true).catch(_ => false)
	if (!isvalidfile) return Error('invalid audio file path')

	// TODO name of qari?
	const {surah} = await prompt({message: "surah", name: "surah", type: "text"})
	let {ayah} = await prompt({message: "begining from ayah", name:"ayah", type:"text"})
	ayah = Number(ayah)

	const audic = new Audic(audiofile)
	audic.addEventListener('ended', () => {
		audic.destroy()
		process.stdin.pause()
	})
	audic.play()
	const audiostart = Date.now()
	const totalayah = await gettotalayah(surah)
	let result = []

	let ayahtext = await getayah(surah, ayah)
	_log('ayah '+ayah+': '+ayahtext)

	keypress(process.stdin)
	process.stdin.on('keypress', async (ch, _data) => {
		switch(ch) {
			case '\u0003':
				process.stdin.pause()
				audic.destroy()
				log('log: immediate exit')
				log(result)
				break

			case ' ':
				const duration = getelapsed(audiostart)
				_log(' | duration: '+duration+'\n')
				result.push({duration, ayah, ayahtext})
				ayah++
				if (ayah > totalayah) {
					log('log: surah is complete')
					await audic.destroy()
					cbresult(result, {surah, audiofile})
					process.stdin.pause()
					return
				}
				ayahtext = await getayah(surah, ayah)
				_log('ayah '+ayah+': '+ayahtext)

				break
		}
	})
	process.stdin.setRawMode(true)
	process.stdin.resume()
}

// TODO As of now, ayahs are expected to be next in 
// continuity, so ayahs after rakat will be hard to track.
// TODO Maybe something like a pair of space i.e. start-end
// for a verse would be more accurate. Yep, inshaa allah.
async function cbresult(result, {audiofile, surah}) {
	log(result)
	const ext = path.extname(audiofile)
	let prev = 0
	result.forEach(r => {
		mp3.cut({
			src: audiofile,
			target: 'surah-'+ surah + '-' +r.ayah+ext,
			start: prev,
			end: r.duration
		})
		prev=r.duration
	})
	// cut audio
}

async function gettotalayah(surah) {
	const r = await fetch('https://api.quran.com/api/v4/chapters/'+surah)
	const body = await r.json()
	return body.chapter.verses_count
}

async function getayah(surah, ayah) {
	const key = [surah, ayah].join(':')
	const r = await fetch(`https://api.quran.com/api/v4/verses/by_key/${key}?language=en&words=true`)
	const body = await r.json()
	const arr = body.verse.words.map(e => e.translation.text)
	return arr.slice(0,-1).join(' ')
}

function getelapsed(starttime) {
	const ms = Date.now() - starttime
	return ms /1000
}
