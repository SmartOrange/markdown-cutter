'use strict';

const assert = require('assert');
const he = require('he');
const MarkdownCutter = require('../src');
const defaultCutter = new MarkdownCutter();
const cutter = new MarkdownCutter({
    matches: [
        {
            key: 'emoticon',
            reg: /\!\[\]\(\[object Object\]#height=18&width=18\)/g,
            getValue(str, length) {
                return '[表情]';
            }
        },
        {
            key: 'at',
            reg: /\[@([^(]{1,100})\(([\w.-_]{1,100})\)\]\(\/[\w.-_]{1,100}\)/g,
            getValue(str, length) {
                return str.replace(/\[@([^(]{1,100})\(([\w.-_]{1,100})\)\]\(\/[\w.-_]{1,100}\)/g, (a, b) => `@${b}`);
            }
        },
    ],
    limits: {
        text: 140,
        link: 20,
    },
    prepareFn: (str) => {
        // 屏蔽表情, 换行去重，去除特殊的空行
        str = str.replace(/\<br\s\/\>/g, '\n')
            .replace(/<a\sname="\S+"><\/a>/g, '\n')
            .replace(/#+\s/g, '')
            .replace(/\u200B/g, '')
            .replace(/\n\n[\s\n]+/g, '\n\n');
        str = str.trim();
        return str;
    },
    textParseFn(str) {
        return str.replace(/[!*\[\]<>`]/g, he.encode);
    },
    suffix: '...',
});

const str = `![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁![image.png](测试图片1)dsadsadsa![image.png](测试图片2)你![image.png](测试图片3)好`;

describe('test/index.test.js', () => {
    describe('defaultCutter', function() {
        it('should work', async function() {
            assert(defaultCutter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(defaultCutter.cut(str, { text: 1 }) === '![image.png](测试图片0)超...');
        });
    });

    describe('cutter', () => {
        it('should work', async function() {
            assert(cutter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(cutter.cut(str, { text: 1 }) === '![image.png](测试图片0)超...');
        });

        it('should work with emoticons', async function() {
            const emoticons = '![]([object Object]#height=18&width=18)';
            assert(cutter.cut(`${emoticons}${emoticons}哈哈`, { emoticon: 100 }) === '[表情][表情]哈哈');
        });

        it('should work with @', async function() {
            assert(cutter.cut('sdas [@墨水(moshui.ink)](/moshui.ink) 这是啥啊啊') === 'sdas @墨水 这是啥啊啊');
        });

        it('should work with empty', async function() {
            const res = cutter.cut('');
            assert(res === '');
        });
    });

    describe('findInMatches', () => {
        assert.deepEqual(cutter.findInMatches('image'), { key: 'image', reg: /!\[.*?\]\(.*?\)/g });
        assert(cutter.findInMatches('emoticon').key === 'emoticon');
    });

    describe('splitByPoints', () => {
        it('should work', () => {
            assert.deepEqual(cutter.splitByPoints('12345678', [0, 1, 2, 3, 4, 5, 6]), ['1', '2', '3', '4', '5', '6']);
        });

        it('should unshift 0, if points[0] !== 0', () => {
            assert.deepEqual(cutter.splitByPoints('12345678', [1, 2, 3, 4, 5, 6]), ['1', '2', '3', '4', '5', '6']);
        });

        it('should sort work', () => {
            assert.deepEqual(cutter.splitByPoints('12345678', [1, 3, 2, 4]), ['1', '2', '3', '4']);
        });

        it('should return string if points is empty', () => {
            assert.deepEqual(cutter.splitByPoints('12345678', []), ['12345678']);
            assert.deepEqual(cutter.splitByPoints('12345678'), ['12345678']);
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

        it('should work with foo match', function() {
            const res = cutter.doMatch('foo[link](xx)', { key: 'foo', reg: /foo/ }, 2);
            assert(res.string === '___[link](xx)');
            assert(res.resources.length === 1);
            assert.deepEqual(res.resources[0], { key: 'foo', index: 0, content: 'foo', length: 3 });
        });

        it('should work with string match', function() {
            const res = cutter.doMatch('string[link](xx)', { key: 'string', reg: 'string' }, 2);
            assert(res.string === '______[link](xx)');
            assert(res.resources.length === 1);
            assert.deepEqual(res.resources[0], { key: 'string', index: 0, content: 'string', length: 6 });
        });

        it('should return if match without reg', function() {
            const res = cutter.doMatch('foo[link](xx)', { key: 'empty' });
            assert(!res);
        });

        it('should work with overReturn', function() {
            const res = cutter.doMatch('foofoo[link](xx)', { key: 'foo', reg: 'foo', overReturn() { return '1'; } }, 1);
            assert(res, 'foo1[link](xx)');
        });
    });

    describe('dissect', function() {
        it('should work', function() {
            const res = cutter.dissect(str);
            assert(res.report);
            assert(res.content);
        });

        it('should return {content: \'\'} if empty', function() {
            const res = cutter.dissect();
            assert.deepStrictEqual(res, { content: '' });
        });

        it('should return {content: \'\'} if prepare return empty', function() {
            const res = new MarkdownCutter({ prepareFn() { } }).dissect(str);
            assert.deepStrictEqual(res, { content: '' });
        });
    });
});

