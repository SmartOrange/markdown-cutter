
const defaultMatches = [
    {
        key: 'image',
        reg: /!\[.*?\]\(.*?\)/g,
    },
    {
        key: 'link',
        reg: /\[.*?\]\(.*?\)/g,
    }
];


class Cutter {
    constructor(options) {
        const { prepareFn, textParseFn, suffix = '', matches = {}, limits = { text: 140, image: 1 } } = options;
        this.matches = [...matches, ...defaultMatches];
        this.suffix = suffix;
        this.prepareFn = prepareFn;
        this.textParseFn = textParseFn;
        this.limits = limits;
    }
    /**
     * 
     * @param {*} string 
     * @param {*} ranges [1,2, 3,4, 5,6]
     */
    slice(string, ranges) {
        const result = [];
        if (!ranges || !ranges.length) return string;
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

    doMatch(string, match, limit = 1) {
        const { reg, key, overReturn } = match;
        const resources = [];
        string = string.replace(reg, function(content, ...arvgs) {
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
        return { string, resources };
    }

    /**
     * 解析所有匹配到资源
     * @param {string} str 
     * @returns 
     */
    analyze(str, limits) {
        let string = str;
        let resources = [];
        const currentLimits = { ...this.limits, ...limits };
        this.matches.forEach(match => {
            const result = this.doMatch(string, match, currentLimits[match.key]);
            string = result.string;
            resources = [...resources, ...result.resources];
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
        if (!resources.length) return this.textParse(string);

        const currentLimits = { ...this.limits, ...limits };
        let isWithSuffix = false;
        let str = string;
        const ignoreLen = resources.map(re => re.length).reduce((a, b) => a + b);
        if (str.length > currentLimits.text + ignoreLen) {
            str = str.slice(0, currentLimits.text + ignoreLen);
            isWithSuffix = true;
        }
        const endIndex = str.length;
        // 初始位置为0,保证第一个肯定是 text
        const ranges = [0];
        // _tmps 排序
        const sortResources = resources.sort((a, b) => a.index - b.index);
        sortResources.forEach(({ index, length }) => {
            if (index < endIndex) {
                ranges.push(index);
            }
            if (index + length < endIndex) {
                ranges.push(index + length);
            }
        });
        ranges.push(endIndex);
        const textNodes = this.slice(str, ranges);
        // 加回资源
        str = textNodes.map((textNode, index) => {
            if (index % 2) {
                const item = sortResources.shift();
                const match = this.findInMatches(item.key);
                return match.getValue ? match.getValue(item.content, textNode.length) : item.content;
            } else {
                return this.textParse(textNode);
            }
        }).join('');
        if (isWithSuffix) {
            str = str + this.suffix;
        }
        return str;
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

module.exports = Cutter;