
const defaultMatches = [
    {
        key: 'image',
        reg: /!\[.*?\]\(.*?\)/g,
    }
];
/**
 * 
 * @param {*} string 
 * @param {*} ranges [1,2, 3,4, 5,6]
 */
function slice(string, ranges) {
    const result = [];
    ranges = ranges.sort((a, b) => a - b);
    if (ranges[0] !== 0) {
        ranges.unshift(0);
    }
    ranges.reduce((previousValue, currentValue) => {
        result.push(string.slice(previousValue, currentValue));
        return currentValue;
    });
    return result;
}

class Splitter {
    constructor({ prepareFn, textParseFn, suffix = '', matches = {}, limits = { text: 140, image: 1 } }) {
        this.matches = [...matches, ...defaultMatches];
        this.suffix = suffix;
        this.prepareFn = prepareFn;
        this.textParseFn = textParseFn;
        this.limits = limits;
    }
    /**
     * 解析所有匹配到资源
     * @param {string} str 
     * @returns 
     */
    analyze(str, limits) {
        let string = str;
        const { matches } = this;
        const resources = [];
        const currentLimits = { ...this.limits, ...limits };
        matches.forEach(({ reg, key, overReturn }) => {
            const limit = currentLimits[key] || 1;
            string = string.replace(reg, function (content, ...arvgs) {
                if (resources.filter(re => re.key = key).length < limit) {
                    resources.push({
                        key,
                        index: arvgs[arvgs.length - 2],
                        content,
                        length: content.length,
                    });
                    return '_'.repeat(content.length);
                }
                return overReturn ? overReturn(content) : '';
            });
        });
        return {
            resources,
            string,
        };
    }

    findInMatches(key) {
        return this.matches.find(match => match.key === key);
    }

    assemble({ string, resources }, limits) {
        const currentLimits = { ...this.limits, ...limits };
        let str = string;
        // 初始位置为0,保证第一个肯定是 text
        const ranges = [0];
        // _tmps 排序
        const sortResources = resources.sort((a, b) => a.index - b.index);
        const ignoreLen = resources.map(re => re.length).reduce((a, b) => a + b);
        sortResources.forEach(({ index, length }) => {
            ranges.push(index);
            ranges.push(index + length);
        });
        ranges.push(str.length);
        if (str.length > currentLimits.text + ignoreLen) {
            str = str.slice(0, currentLimits.text + ignoreLen) + this.suffix;
        }
        const textNodes = slice(str, ranges);
        // 加回资源
        return textNodes.map((textNode, index) => {
            if (index % 2) {
                const item = sortResources.shift();
                const match = this.findInMatches(item.key);
                return match.getValue ? match.getValue(item.content) : item.content;
            } else {
                return this.textParse(textNode);
            }
        }).join('');
    }

    prepare(txt) {
        if (this.prepareFn) {
            return this.prepareFn(txt);
        }
        return txt;
    }

    textParse(txt) {
        if (this.textParseFn) {
            return this.textParseFn(txt);
        }
        return txt;
    }

    cut(txt, options) {
        return this.dissect(txt, options).content;
    }

    dissect(txt, options) {
        txt = this.prepare(txt);
        if (!txt) return { content: '' };
        const report = this.analyze(txt, options);
        return {
            report,
            content: this.assemble(report, options)
        }
    }
}

module.exports = (options) => new Splitter(options);