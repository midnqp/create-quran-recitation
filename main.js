import enquirer from 'enquirer'
import os from 'node:os'
import fs from 'fs-extra'
import Audic, {playAudioFile} from 'audic'
import process from 'node:process'
import keypress from 'keypress'

const log = console.log
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

	const {surah} = await prompt({message: "surah", name: "surah", type: "text"})
	let {ayah} = await prompt({message: "begining from ayah", name:"ayah", type:"text"})
	ayah = Number(ayah)

	const audic = new Audic(audiofile)
	audic.addEventListener('ended', () => {
		audic.destroy()
		process.stdin.resume()
	})
	//audic.play()
	const audiostart = Date.now()
	const totalayah = await gettotalayah(surah)
	//const firstayah = await getayah(surah, ayah)
	let audioplaying = false
	let result = []

	log('log: press space to begin...')
	keypress(process.stdin)
	process.stdin.on('keypress', (ch, _data) => {
		switch(ch) {
			case '\u0003':
				process.stdin.pause()
				log('log: immediate exit')
				log(result)
				break

			case ' ':
				if (!audioplaying) {
					//playAudioFile(audiofile)
					audic.play()
					audioplaying=true
				}
				const duration = getelapsed(audiostart)
				if (result.length) result.at(-1).duration = duration
				getayah(surah, ayah).then(ayahtext => {
					result.push({duration: -1, ayah, ayahtext})
					log(duration, 'ayah '+ayah+': '+ayahtext)

					ayah++
					if (ayah > totalayah) {
						process.stdin.pause()
						log('log: surah is complete')
						audic.destroy()

						result.at(-1).duration = duration
						log(result)
					}
				})

				break
		}
	})
	process.stdin.setRawMode(true)
	process.stdin.resume()
}

async function gettotalayah(surah) {
	const r = await fetch('https://api.quran.com/api/v4/chapters/1')
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
