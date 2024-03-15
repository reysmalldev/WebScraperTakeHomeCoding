import * as cheerio from 'cheerio'
import { Selectors } from './utils/selectors.js'
import * as fs from 'fs'

function removeBreakLines(value) {
    // Filtering out properties
    if (typeof value === 'string') {
        value = value.replace(/(\\n)/gm, '')
    }
    return value
}
async function requester() {
    const basePath = 'https://infosimples.com'
    const desafioPage = `${basePath}/vagas/desafio/commercia/product.html`

    const headers = new Headers({
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    })

    let res = await fetch(desafioPage, {
        method: 'GET',
        headers: headers,
    })

    let docBody = await res.text()
    let requestedUrl = res.url
    return {
        docBody: docBody,
        requestedUrl: requestedUrl,
    }
}
async function extractContent(docBody, requestedUrl) {
    const parsePrices = (price) => {
        try {
            price = price.replace(/R\$/g, '').replace(/\,/g, '.').replace(/\s/g, '')
            return parseFloat(price)
        } catch (e) {
            return null
        }
    }

    const $ = cheerio.load(String(docBody))
    let title = $(Selectors.title)?.text()?.trim()
    const brand = $(Selectors.brand)?.text()

    const categories = []
    $(Selectors.categories).each((index, item) => {
        categories.push($(item)?.text()?.trim())
    })

    let skusItems = []
    $(Selectors.skus_items).each((index, item) => {
        let name = null,
            currentPrice = null,
            oldPrice = null,
            available = null

        name = $(item).find(Selectors.skus_item_title)?.text().trim()
        currentPrice = parsePrices($(item).find(Selectors.skus_item_price)?.text()?.trim())
        oldPrice = parsePrices($(item).find(Selectors.skus_item_old_price)?.text()?.trim())
        available = $(item).filter('.card.not-avaliable').length == 0
        skusItems.push({
            name: name,
            current_price: currentPrice ? currentPrice : null,
            old_price: oldPrice ? oldPrice : null,
            available: available,
        })
    })
    let properties = []
    $(Selectors.properties_table_rows).each((index, item) => {
        let property = removeBreakLines($(item).children().eq(0).text()).trim(),
            value = removeBreakLines($(item)?.children()?.eq(1)?.text())?.trim()

        properties.push({
            label: property,
            value: value,
        })
    })

    let description = ''
    $(Selectors.description).each((index, item) => {
        description += $(item)?.text()?.trim() + '\n'
    })
    $(Selectors.additional_properties_table_rows).each((index, item) => {
        let property = removeBreakLines($(item).children().eq(0).text()).trim(),
            value = removeBreakLines($(item).children().eq(1).text()).trim()
        properties.push({
            label: property,
            value: value,
            asAdditionalProperty: true,
        })
    })

    let reviews = []
    $(Selectors.comment_section).each((index, item) => {
        let name = $(item)?.find(Selectors.commenter_name)?.text()
        let date = $(item)?.find(Selectors.commentator_comment_date)?.text()
        let score = $(item)?.find(Selectors.commentator_given_stars)?.text()
        let text = $(item)?.find(Selectors.commentator_comment_text)?.text()
        let scoreCount = 0
        score.split('').forEach((item) => {
            console.log(`item: ${item} \n`)
            if (item.match(/★/g)) {
                scoreCount += 1
            }
        })
        reviews.push({
            name: name,
            date: date,
            score: scoreCount,
            text: text,
        })
    })
    const reviews_average_score = parseFloat(
        $(Selectors.review_average_score)?.text()?.replace('Average score: ', '')?.replace(/\/+./g, ''),
    )
    const productPage = {
        title: title,
        brand: brand,
        categories: categories,
        description: description,
        skus: skusItems,
        properties: properties,
        reviews: reviews,
        reviews_average_score: reviews_average_score,
        url: requestedUrl,
    }

    try {
        fs.writeFileSync('productPage.json', JSON.stringify(productPage, null, 2))
    } catch (e) {
        console.log('error: \n' + e)
    }
}
async function main() {
    let { docBody, requestedUrl } = await requester()
    if (docBody != '' && docBody != undefined) {
        extractContent(docBody, requestedUrl)
    }
}

main()
