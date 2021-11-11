'use strict';

const defaultMatches = [
    {
        key: 'image',
        reg: /!\[.*?\]\(.*?\)/g,
    },
    {
        key: 'link',
        reg: /\[.*?\]\(.*?\)/g,
        exportTxt(content) {
            let mathces = content.match(/\[(.*?)\]\(.*?\)/);
            return mathces ? mathces[1] : '';
        }
    }
];

const DEFAULT_LIMITS = {
    text: 140,
    image: 1,
    link: 1,
};

class Cutter {
    constructor(options = {}) {
        const { onPrepare, onTextParse, suffix = '', matches = [], limits = DEFAULT_LIMITS } = options;
        this.matches = [...matches, ...defaultMatches];
        this.suffix = suffix;
        if (onPrepare) {
            this.onPrepare = onPrepare;
        }
        if (onTextParse) {
            this.onTextParse = onTextParse;
        }
        this.limits = limits;
    }

    /**
     * Split string based on cut points
     * @param {*} string 
     * @param {*} points [1,2, 3,4, 5,6]
     */
    splitByPoints(string, points) {
        const result = [];
        if (!points || !points.length) return [string];
        points = points.sort((a, b) => a - b);
        if (points[0] !== 0) points.unshift(0);
        points.reduce((previousValue, currentValue) => {
            result.push(string.slice(previousValue, currentValue));
            return currentValue;
        });
        return result;
    }

    doMatch(string, match, limit = 1) {
        const { reg, key, overReturn, exportTxt } = match;
        if (!reg) return console.warn('match:%s has no reg', key);

        const resources = [];
        string = string.replace(reg, function(content, ...arvgs) {
            if (resources.filter(re => re.key = key).length < limit) {
                const resource = {
                    key,
                    index: arvgs[arvgs.length - 2],
                    content,
                    length: content.length,
                };
                if (exportTxt) {
                    resource.txt = exportTxt(content);
                }
                resources.push(resource);
                return '_'.repeat(content.length);
            }
            return overReturn ? overReturn(content) : '';
        });
        return { string, resources };
    }

    /**
     * Parse all matching resources
     * @param {string} string 
     * @param {object} limits 
     * @returns 
     */
    analyze(string, limits = {}) {
        let str = string;
        let resources = [];
        const currentLimits = { ...this.limits, ...limits };
        this.matches.forEach(match => {
            const result = this.doMatch(str, match, currentLimits[match.key]);
            if (result) {
                str = result.string;
                resources = [...resources, ...result.resources];
            }
        });
        return {
            resources,
            string: str,
        };
    }

    findInMatches(key) {
        return this.matches.find(match => match.key === key);
    }

    assemble({ string, resources = [] } = {}, limits = {}) {
        if (!resources.length) return this.textParse(string);

        const currentLimits = { ...this.limits, ...limits };
        let isSuffixRequired = false;
        let str = string;
        const ignoreLen = resources.map(re => re.txt ? re.length - re.txt.length : re.length).reduce((a, b) => a + b);
        if (str.length > currentLimits.text + ignoreLen) {
            str = str.slice(0, currentLimits.text + ignoreLen);
            isSuffixRequired = true;
        }
        const endIndex = str.length;
        // The initial position is 0, to ensure that the first one is definitely text
        const points = [0];
        const sortResources = resources.sort((a, b) => a.index - b.index);
        sortResources.forEach(({ index, length }) => {
            if (index < endIndex) {
                points.push(index);
            }
            if (index + length < endIndex) {
                points.push(index + length);
            }
        });
        points.push(endIndex);
        const textNodes = this.splitByPoints(str, points);
        // Add resources back
        str = textNodes.map((textNode, index) => {
            if (index % 2) {
                const item = sortResources.shift();
                const match = this.findInMatches(item.key);
                return match.getValue ? match.getValue(item.content, textNode.length) : item.content;
            } else {
                return this.textParse(textNode);
            }
        }).join('');
        if (isSuffixRequired) {
            str = str + this.suffix;
        }
        return str;
    }

    prepare(txt) {
        if (this.onPrepare) {
            return this.onPrepare(txt);
        }
        return txt;
    }

    textParse(txt) {
        if (this.onTextParse) {
            return this.onTextParse(txt);
        }
        return txt;
    }

    cut(txt, options = {}) {
        return this.dissect(txt, options).content;
    }

    dissect(txt, options = {}) {
        if (!txt) return { content: '' };
        txt = this.prepare(txt);
        if (!txt) return { content: '' };
        const report = this.analyze(txt, options);
        return {
            report,
            content: this.assemble(report, options)
        };
    }
}

module.exports = Cutter;
