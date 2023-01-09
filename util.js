import rtlarabic from 'rtl-arabic'
import {stripHtml} from 'string-strip-html'
import htmltags from 'html-tags'

async function getarabic(surah, ayah) {
	const key = [surah, ayah].join(':')
	const mushaf = 'uthmani_simple'
	const r = await fetch(`https://api.quran.com/api/v4/quran/verses/${mushaf}?verse_key=` + key)
	const body = await r.json()
	const arabic = body.verses.map(e => e['text_' + mushaf]).join('\n')
	const text = new rtlarabic(arabic, { numbers: true, harakat: true, multiline: true }).convert()
	return text
}

async function gettotalayah(surah) {
	const r = await fetch('https://api.quran.com/api/v4/chapters/' + surah)
	const body = await r.json()
	return body.chapter.verses_count
}

async function getayah(surah, ayah) {
	const key = [surah, ayah].join(':')
	const url = `https://api.quran.com/api/v4/quran/translations/20?verse_key=`+key
	const r = await fetch(url)
	const body = await r.json()
	const text = body.translations.map(e => e.text).join('\n')
	const {result} = stripHtml(text, {
		stripTogetherWithTheirContents: [...htmltags]
	})
	return result
}

function getelapsed(starttime) {
	const ms = Date.now() - starttime
	return ms / 1000
}

export {getarabic, getelapsed, getayah, gettotalayah}
