'use strict';
const debug = require('debug')('cutter');

const defaultMatches = [
    {
        key: 'image',
        reg: /!\[.*?\]\(.*?\)/g,
    },
    {
        key: 'link',
        reg: /\[.*?\]\(.*?\)/g,
        getTextLength(content: string) {
            let mathces = content.match(/\[(.*?)\]\(.*?\)/);
            return mathces ? mathces[1].length : 0;
        },
        getValue(content: string, len: number) {
            return content.replace(/\[(.*?)\]\(.*?\)/, (a: string, b: string) => {
                return a.replace(b, b.slice(0, len) + (b.length > len ? '...' : ''));
            });
        }
    }
];

interface Limit {
    text: number,
    image: number,
    link: number,
}

interface Match {
    key: string,
    reg: RegExp,
    getTextLength?(content: string): number,
    getValue?(content: string, len: number): string,
    overReturn?(content: string): string,
}

interface Resource {
    key: string,
    index: number,
    content: string,
    length: number,
    textLength?: number,
};

interface Report {
    string: string,
    resources: Resource[],
}

interface Options {
    suffix?: string,
    matches: Match[],
    limits: Limit,
    onPrepare?(content: string): string,
    onTextParse?(txt: string): string;
}


const DEFAULT_LIMITS = {
    text: 140,
    image: 1,
    link: 1,
};

class Cutter {
    suffix: string;
    limits: Limit;
    matches: Match[];

    onTextParse: (txt: string) => string;
    onPrepare: (content: string) => string;

    constructor(options: Options) {
        const { onPrepare, onTextParse, suffix = '', matches = [], limits = DEFAULT_LIMITS } = options;
        this.limits = limits;
        this.suffix = suffix;
        this.matches = [...matches, ...defaultMatches];

        if (onPrepare) this.onPrepare = onPrepare;
        if (onTextParse) this.onTextParse = onTextParse;
    }

    /**
     * Split string based on cut points
     * @param {*} string 
     * @param {*} points [1,2, 3,4, 5,6]
     */
    splitByPoints(string: string, points: number[]): string[] {
        const result = [];
        if (!points || !points.length) return [string];
        points = points.sort((a: number, b: number) => a - b);
        if (points[0] !== 0) points.unshift(0);
        points.reduce((previousValue: any, currentValue: any) => {
            result.push(string.slice(previousValue, currentValue));
            return currentValue;
        });
        return result;
    }

    doMatch(string: string, match: Match, limit = 1): { string: string; resources: Resource[] } | void {
        const { reg, key, overReturn, getTextLength } = match;
        if (!reg) return console.warn('match:%s has no reg', key);

        const resources = [];
        string = string.replace(reg, function (content: string, ...arvgs: any[]) {
            if (resources.filter(re => re.key = key).length < limit) {
                const resource: Resource = {
                    key,
                    index: arvgs[arvgs.length - 2],
                    content,
                    length: content.length,
                };
                if (getTextLength) {
                    resource.textLength = getTextLength(content);
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
    analyze(string: any, limits = {}): Report {
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

    findInMatches(key: string): Match {
        return this.matches.find(match => match.key === key);
    }

    assemble({ string, resources = [] }, limits = {}): string {
        debug('assemble params', string, resources, limits);
        const currentLimits = { ...this.limits, ...limits };
        if (!string) return;
        if (!resources.length) return this.textParse(string.slice(0, currentLimits.text)) + this.suffix;

        let str = string;
        const ignoreLen = resources.map(re => re.length).reduce((a, b) => a + b);
        const maxEndIndex = currentLimits.text + ignoreLen;
        // The initial position is 0, to ensure that the first one is definitely text
        const points = [0];
        const sortResources = resources.sort((a, b) => a.index - b.index);
        sortResources.forEach(({ index, length }) => {
            if (index < maxEndIndex) {
                points.push(index);
            }
            if (index + length < maxEndIndex) {
                points.push(index + length);
            }
        });
        points.push(maxEndIndex);
        let isSuffixRequired = maxEndIndex < string.length;
        debug('isSuffixRequired', isSuffixRequired);

        const textNodes = this.splitByPoints(str, points);
        debug('points', points);
        debug('textNodes', textNodes);

        let resultLen = 0;
        // Add resources back
        const result = textNodes.map((textNode, index) => {
            const quotaLen = currentLimits.text - resultLen;
            const isResourceReplaceNode = index % 2;

            if (quotaLen <= 0) return;
            if (quotaLen <= textNode.length) {
                isSuffixRequired = true;
                textNode = textNode.slice(0, quotaLen);
            }

            if (isResourceReplaceNode) {
                const item = sortResources.shift();
                const match = this.findInMatches(item.key);
                if (item.textLength) {
                    isSuffixRequired = false;
                    resultLen = resultLen + item.textLength;
                }
                return match.getValue ? match.getValue(item.content, textNode.length) : item.content;
            } else {
                resultLen = resultLen + textNode.length;
                return this.textParse(textNode);
            }
        }).filter(i => i);
        debug('result', result);

        str = result.join('');

        if (isSuffixRequired) {
            str = str + this.suffix;
        }
        return str;
    }

    prepare(txt: string): string {
        if (this.onPrepare) {
            return this.onPrepare(txt);
        }
        return txt;
    }

    textParse(txt: string): string {
        if (this.onTextParse) {
            return this.onTextParse(txt);
        }
        return txt;
    }

    cut(txt: string, options = {}): string {
        return this.dissect(txt, options).content;
    }

    dissect(txt: string, options = {}): { report?: Report, content: string } {
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
