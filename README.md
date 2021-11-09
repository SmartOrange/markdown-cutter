# markdown-cutter

[![Package Quality](https://packagequality.com/shield/markdown-cutter.svg)](https://packagequality.com/#?package=markdown-cutter)
[![NPM Downloads](https://img.shields.io/npm/dm/markdown-cutter.svg?style=flat)](https://www.npmjs.com/package/markdown-cutter)
[![NPM Version](https://img.shields.io/npm/v/markdown-cutter.svg?style=flat)](https://www.npmjs.com/package/markdown-cutter)

Markdown text cutter, will not cut off links, pictures

## Usage

```javascript
const MarkdownCutter = require('markdown-cutter');
const cutter = new MarkdownCutter({
    // Custom matches
    matches: [
        {
            key: 'emoticon',
            reg: /\!\[\]\(\[object Object\]#height=18&width=18\)/g,
            getValue(str) {
                return '[emoticon]'
            }
        },
    ],
    // matches limit
    limits: {
        text: 140, // Up to 140 characters,
        image: 1, // 1 image,
        emoticon: 3, // 3 emoticons;
    },
    // content preparation
    prepare: (str) =>  str.trim(),
    textParse: (str) => str.replace(/[!*\[\]<>`]/g, he.encode),
    suffix: '...',
});
const content = 'balabala ![image](xxx) ![]([object Object]#height=18&width=18) balabala';
// quick cut
console.log(cutter.cut(content));
// 'balabala ![image](xxx) [emoticon] balabala'

// analyze only 
console.log(cutter.analyze(content));
// { resources: [{key:'image', content: '![image](xxx)', index: 9}], string: 'balabala _______ _______ balabala'}

// analyze and cut
console.log(cutter.dissect(content));
// {report: "as analyze result", content: "as cut result"}
```

## Built-in matches 
*image* | /!\[.*?\]\(.*?\)/g | match images