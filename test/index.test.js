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
    onPrepare: (str) => {
        // 屏蔽表情, 换行去重，去除特殊的空行
        str = str.replace(/\<br\s\/\>/g, '\n')
            .replace(/<a\sname="\S+"><\/a>/g, '\n')
            .replace(/#+\s/g, '')
            .replace(/\u200B/g, '')
            .replace(/\n\n[\s\n]+/g, '\n\n');
        str = str.trim();
        return str;
    },
    suffix: '...',
});

const str = `![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁![image.png](测试图片1)dsadsadsa![image.png](测试图片2)你![image.png](测试图片3)好`;

describe('test/index.test.js', function() {
    describe('defaultCutter', function() {
        it('should work', function() {
            assert(defaultCutter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(defaultCutter.cut(str, { text: 1 }) === '![image.png](测试图片0)超');
        });

        it('should work with all links', function() {
            const links = [...new Array(2)].map((i, index) => `[link${index}](link_url:${index})`).join('abc');
            assert(cutter.cut(links, { text: 1, link: 20 }) === '[l...](link_url:0)');
            assert(cutter.cut(links, { text: 6, link: 20 }) === '[link0](link_url:0)a...');
            assert(cutter.cut(links, { text: 7, link: 20 }) === '[link0](link_url:0)ab...');
            assert(cutter.cut(links, { text: 9, link: 20 }) === '[link0](link_url:0)abc[l...](link_url:1)');
        });
    });

    describe('cutter', function() {
        it('should work', function() {
            assert(cutter.cut(str) === '![image.png](测试图片0)超人会不会飞我不知道，你肯定不会飞🫁dsadsadsa你好');
            assert(cutter.cut(str, { text: 1 }) === '![image.png](测试图片0)超...');
        });

        it('should work with emoticons', function() {
            const emoticons = '![]([object Object]#height=18&width=18)';
            assert(cutter.cut(`${emoticons}${emoticons}哈哈`, { emoticon: 100 }) === '[表情][表情]哈哈');
        });

        it('should work with @', function() {
            assert(cutter.cut('sdas [@墨水(moshui.ink)](/moshui.ink) 这是啥啊啊') === 'sdas @墨水 这是啥啊啊');
        });

        it('should work with empty', function() {
            const res = cutter.cut('');
            assert(res === '');
        });
    });

    describe('findInMatches', function() {
        assert.deepEqual(cutter.findInMatches('image'), { key: 'image', reg: /!\[.*?\]\(.*?\)/g });
        assert(cutter.findInMatches('emoticon').key === 'emoticon');
    });

    describe('splitByPoints', function() {
        it('should work', function() {
            assert.deepEqual(cutter.splitByPoints('12345678', [0, 1, 2, 3, 4, 5, 6]), ['1', '2', '3', '4', '5', '6']);
        });

        it('should unshift 0, if points[0] !== 0', function() {
            assert.deepEqual(cutter.splitByPoints('12345678', [1, 2, 3, 4, 5, 6]), ['1', '2', '3', '4', '5', '6']);
        });

        it('should sort work', function() {
            assert.deepEqual(cutter.splitByPoints('12345678', [1, 3, 2, 4]), ['1', '2', '3', '4']);
        });

        it('should return string if points is empty', function() {
            assert.deepEqual(cutter.splitByPoints('12345678', []), ['12345678']);
            assert.deepEqual(cutter.splitByPoints('12345678'), ['12345678']);
        });
    });

    describe('doMatch', function() {
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
            assert.deepEqual(res.resources[0], { key: 'link', index: 4, content: '[link](xx)', length: 10, textLength: 4 });
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
            const res = cutter.doMatch('foofoo[link](xx)', { key: 'foo', reg: /foo/g, overReturn() { return '1'; } }, 1);
            assert(res.string === '___1[link](xx)');
        });

        it('should work with getTextLength', function() {
            const res = cutter.doMatch('foo[link](xx)', { key: 'foo', reg: /foo/g, getTextLength() { return 1; } }, 1);
            assert(res.string === '___[link](xx)');
            assert.deepStrictEqual(res.resources, [{ key: 'foo', index: 0, content: 'foo', length: 3, textLength: 1 }]);
        });
    });

    describe('textParse', function() {
        it('should work', function() {
            let res = new MarkdownCutter({
                onTextParse: txt => txt.replace(/[!*\[\]<>`]/g, he.encode),
            }).textParse('[]<>`');
            assert(res === he.encode('[]<>`'));
        });
    });

    describe('assemble', function() {
        it('should work with empty', function() {
            const res = cutter.assemble();
            assert(!res);
        });

        it('should work txtParse if resources is empty', function() {
            let res = new MarkdownCutter({
                onTextParse: txt => txt.replace(/[!*\[\]<>`]/g, he.encode),
            }).assemble({ string: '[]<>`' });
            assert(res === he.encode('[]<>`'));
        });

        it('should work with resource.txt ', function() {
            const res = new MarkdownCutter().assemble({
                string: '12345_________',
                resources: [{
                    key: 'link',
                    index: 5,
                    content: 'xxxxx',
                    length: 5,
                    textLength: 5,
                }, {
                    key: 'link',
                    index: 10,
                    content: 'sssss',
                    length: 5,
                    textLength: 5,
                }]
            }, { text: 9 });
            assert(res === '12345xxxxx');
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

        it('should return {content: \'\'} if onPrepare return empty', function() {
            const res = new MarkdownCutter({ onPrepare() { } }).dissect(str);
            assert.deepStrictEqual(res, { content: '' });
        });
    });
});

