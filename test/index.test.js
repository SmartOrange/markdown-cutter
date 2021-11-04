const assert = require('assert');
const he = require('he');

const splitter = require('../src')({
    matches: [
        {
            key: 'emoticon',
            reg: /\!\[\]\(\[object Object\]#height=18&width=18\)/g,
            getValue(str) {
                return '[表情]'
            }
        },
        {
            key: 'at',
            reg: /\[@([^(]{1,100})\(([\w.-_]{1,100})\)\]\(\/[\w.-_]{1,100}\)/g,
            getValue(str) {
                return str.replace(/\[@([^(]{1,100})\(([\w.-_]{1,100})\)\]\(\/[\w.-_]{1,100}\)/g, (a, b) => `@${ b }`);
            }
        }
    ],
    limits: {
        text: 140,
    },
    prepare: (str) => {
        // 屏蔽表情, 换行去重，去除特殊的空行
        str = str.replace(/\<br\s\/\>/g, '\n')
            .replace(/<a\sname="\S+"><\/a>/g, '\n')
            .replace(/#+\s/g, '')
            .replace(/\u200B/g, '')
            .replace(/\n\n[\s\n]+/g, '\n\n');
        str = str.trim();
        return str;
    },
    textParse(str) {
        return str.replace(/[!*\[\]<>`]/g, he.encode);
    },
    suffix: '...',
});
const str = `![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁![image.png](测试图片1)dsadsadsa![image.png](测试图片2)你![image.png](测试图片3)好`;

describe('test/index.test.js', () => {
    describe('splitter', () => {
        it('should work', async function () {
            assert(splitter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(splitter.cut(str, { text: 1 }) === '![image.png](测试图片0)超...');
        });

        it('should work with emoticons', async function () {
            const emoticons = '![]([object Object]#height=18&width=18)';
            const str = `${ emoticons }${ emoticons }哈哈`;
            assert(splitter.cut(str, { emoticon: 100 }) === '[表情][表情]哈哈');
        });

        it('should work with @', async function () {
            const str = 'sdas [@墨水(moshui.ink)](/moshui.ink) 这是啥啊啊';
            assert(splitter.cut(str) === 'sdas @墨水 这是啥啊啊');
        });

        it('should work with empty', async function () {
            const res = splitter.cut('');
            assert(res === '');
        });
    });
});

