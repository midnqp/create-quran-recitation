import enquirer from 'enquirer'
import os from 'node:os'
import fs from 'fs-extra'
import Audic from 'audic'
import process from 'node:process'
import keypress from 'keypress'
import path from 'node:path'
import childp from 'node:child_process'
import {getarabic, getelapsed, getayah, gettotalayah} from './util.js'

const log = console.log
const _log = process.stdout.write.bind(process.stdout)
const prompt = enquirer.prompt

const _return = await main()
if (_return) log(_return)

async function main() {
	let {audiofile} = await prompt({message: "audio file", name: "audiofile", type: "text", required: true})
	audiofile = audiofile.trim()
	if (audiofile[0] == '~') {
		audiofile = os.homedir() + audiofile.slice(1)
	}
	const isvalidfile = await fs.access(audiofile).then(_ => true).catch(_ => false)
	if (!isvalidfile) return Error('invalid audio file path')

	// TODO name of qari?
	let {surah} = await prompt({message: "surah", name: "surah", type: "text", initial: 1})
	surah = Number(surah)
	let {ayah} = await prompt({message: "begining from ayah", name:"ayah", type:"text", initial: 1})
	ayah = Number(ayah)
	let {audioseek} = await prompt({message: 'seek audio', name: 'audioseek', type:'text', initial: 0})
	audioseek = Number(audioseek)

	const totalayah = await gettotalayah(surah)
	let result = []

	const ayahobj = {}
	const arabicobj={}
	for (let i=ayah; i <=totalayah; i++) {
		const translation = await getayah(surah, i)
		const arabictext = await getarabic(surah, i)
		ayahobj[i] = translation
		arabicobj[i] = arabictext
	}
	log('ayah '+ayah)
	log(arabicobj[ayah])
	_log(ayahobj[ayah])

	const audic = new Audic(audiofile)
	let playstarted = 0
	audic.addEventListener('playing', () => {
		if (audioseek) audic.currentTime = audioseek
	})
	audic.addEventListener('seeked', () => {
		if (!playstarted) playstarted=Date.now()
	})
	audic.addEventListener('ended', () => {
		audic.destroy()
	})
	audic.play()

	const iter = {pendingend:false, start:-1, end:-1, duration: -1, start_s: -1, end_s:-1}
	process.stdin.setEncoding("utf8")
	keypress(process.stdin)
	process.stdin.on('keypress', async (ch, _data) => {
		switch(ch) {
			case '\u0003':
				process.stdin.pause()
				audic.destroy()
				log('\nlog: immediate exit')
				log(result)
				break

			case ' ':
				if (!iter.pendingend) {
					iter.start = Date.now()
					iter.start_s = getelapsed(playstarted)
					iter.pendingend=true
					_log(' | started '+audic.currentTime+'s')
				}
				else {
					_log(' | ended '+audic.currentTime+'s\n\n')
					iter.end = Date.now()
					iter.end_s = getelapsed(playstarted)
					iter.duration = (iter.end - iter.start)/1000
					result.push({ayah, ayahtext: ayahobj[ayah], start: iter.start, end: iter.end, duration: iter.duration, start_s: audioseek+iter.start_s, end_s: audioseek+iter.end_s})
					ayah++
					if (ayah > totalayah) {
						log('log: surah is complete')
						await audic.destroy()
						cbresult(result, {surah, audiofile})
						process.stdin.pause()
						break
					}
					//ayahtext = await getayah(surah, ayah)
					//ayaharabic=  await getarabic(surah, ayah)

					log('ayah '+ayah)
					log(arabicobj[ayah])
					_log(ayahobj[ayah])
					iter.pendingend=false
					break
				}
				break

			case 'e':
				// end now, save stuff
				if (iter.pendingend) break
				log('\nlog: complete up to '+(ayah-1)+' ayah')
				process.stdin.pause()
				await audic.destroy()
				cbresult(result, {surah, audiofile})
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
	//log(result)
	const ext = path.extname(audiofile)
	let prev = 0
	result.forEach(r => {
		const started = Date.now()
		const target = 'surah-'+ surah + '-' +r.ayah+ext
		_log(`log: saving ayah file "${target}"`)
		
		try{
			const cmd = `ffmpeg -v 0 -loglevel 0 -y -i ${audiofile} -ss ${r.start_s} -to ${r.end_s} -qscale 0 ${target}`
			childp.execSync(cmd)
		} catch(err) {
			const out = err.stdout.toString().trim()
			if (out) log('ffmpeg command failed:\n'+out)
		}

		_log(' | done in '+getelapsed(started)+'s\n')
	})
}

