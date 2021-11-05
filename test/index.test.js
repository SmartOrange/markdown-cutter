const assert = require('assert');
const he = require('he');
const MarkdownCutter = require('../src');
const cutter = new MarkdownCutter({
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
                return str.replace(/\[@([^(]{1,100})\(([\w.-_]{1,100})\)\]\(\/[\w.-_]{1,100}\)/g, (a, b) => `@${b}`);
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
    describe('cutter', () => {
        it('should work', async function() {
            assert(cutter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(cutter.cut(str, { text: 1 }) === '![image.png](测试图片0)超...');
        });

        it('should work with emoticons', async function() {
            const emoticons = '![]([object Object]#height=18&width=18)';
            const str = `${emoticons}${emoticons}哈哈`;
            assert(cutter.cut(str, { emoticon: 100 }) === '[表情][表情]哈哈');
        });

        it('should work with @', async function() {
            const str = 'sdas [@墨水(moshui.ink)](/moshui.ink) 这是啥啊啊';
            assert(cutter.cut(str) === 'sdas @墨水 这是啥啊啊');
        });

        it('should work with empty', async function() {
            const res = cutter.cut('');
            assert(res === '');
        });
    });
    describe('functions', () => {
        it('findInMatches', () => {
            assert.deepEqual(cutter.findInMatches('image'), { key: 'image', reg: /!\[.*?\]\(.*?\)/g });
            assert(cutter.findInMatches('emoticon').key === 'emoticon');
        });

        it('slice', () => {
            assert.deepEqual(cutter.slice('12345678', [1, 2, 3, 4, 5, 6]), ['1', '2', '3', '4', '5', '6']);
            assert.deepEqual(cutter.slice('12345678', [1, 3, 2, 4]), ['1', '2', '3', '4']);
        });
    });

    describe('doMatch', () => {
        it('should work with image match', function() {
            const res = cutter.doMatch('tes![image](url)t[link](xx)', cutter.findInMatches('image'), 2);
            assert(res.string === 'tes_____________t[link](xx)');
            assert(res.resources.length === 1);
            assert.deepEqual(res.resources[0], { key: 'image', index: 3, content: '![image](url)', length: 13 });
        });

        it('should work with link match', function() {
            const res = cutter.doMatch('test[link](xx)', cutter.findInMatches('link'), 2);
            assert(res.string === 'test__________');
            assert(res.resources.length === 1);
            assert.deepEqual(res.resources[0], { key: 'link', index: 4, content: '[link](xx)', length: 10 });
        });
    });
});

