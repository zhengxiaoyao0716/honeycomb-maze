const domain = require('domain');
const readline = require('readline');

const Game = require('./index');
console.log(Game.info);


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 读取输入
function getInput(tip, validator) {
    return new Promise((resolve, reject) => {
        rl.question(tip, answer => {
            const [value, ok] = validator(answer);
            if (ok) {
                resolve(value);
            } else {
                resolve(getInput(tip, validator));
            }
        });
    }).catch(e => {
        console.trace(e);
        resolve(getInput(tip, validator));
    });
}
function isOk(tip = '这样可以吗？') {
    return getInput(tip, answer => {
        return [
            !answer.includes('否')
            && !answer.includes('不')
            && !answer.includes('N')
            && !answer.includes('n'),
            true
        ];
    })
}
// 初始化游戏参数
function initGame() {
    let [size, num, factor] = [6, 4, 0.5];
    return getInput(`请输入迷宫边长，默认为${size}：`, answer => {
        if (answer == '') {
            return [size, true];
        }
        const value = parseInt(answer);
        if (Number.isNaN(value) || value < 3) {
            console.log('无效的输入，迷宫尺寸为整数，最小为3');
            return [, false];
        }
        return [value, true];
    }).then(v => {
        size = v;
        return getInput(`请输入目标数量，默认为${num}：`, answer => {
            if (answer == '') {
                return [num, true];
            }
            const value = parseInt(answer);
            if (Number.isNaN(value) || value < 0 || value > 6) {
                console.log('无效的输入，目标数量为整数，取值范围为[0, 6]');
                return [, false];
            }
            return [value, true];
        });
    }).then(v => {
        num = v;
        return getInput(`请输入门锁的因子，默认为${factor}：`, answer => {
            if (answer == '') {
                return [factor, true];
            }
            const value = parseFloat(answer);
            if (Number.isNaN(value) || value < 0 || value > 1) {
                console.log('无效的输入，有效因子取值范围为[0, 1]');
                return [, false];
            }
            return [value, true];
        });
    }).then(v => {
        factor = v;
        console.log(`迷宫参数为：边长${size}, 目标数量${num}, 门锁因子${factor}`);
        return isOk();
    }).then(ok => {
        return ok ?
            isOk('开启提示吗？').then(ok => [size, num, factor, ok])
            : initGame();
    });
}

// 主函数
function main() {
    let game;
    function start() {
        game = undefined;
        initGame().then(([size, num, factor, withTip]) => {
            function binder(game) {
                function charFromDoor(room, door, chars = ['#', 'E', '=', '_']) {
                    return room.doors[door] ? room.locks[door] ? chars[2] : room.doors[door] == 'EXIT' ? chars[1] : chars[3] : chars[0];
                }
                game.onFind = (num) => {
                    console.log(num ? `发现一个目标，剩余${num}个` : '恭喜你找到了所有目标，现在可以找到出口离开了');
                }
                game.onMove = (room, toward) => {
                    process.stdout.write(`\r${
                        charFromDoor(room, (toward + 5) % 6)
                        } ${
                        charFromDoor(room, (toward) % 6)
                        } ${
                        charFromDoor(room, (toward + 1) % 6)
                        }` + (
                            withTip ? ` (提示) 第${1 + room.coord[0]}圈` + (
                                room.coord[0] ? `${(2 * room.coord[1] + 4) % 12}点${1 + room.coord[2]}号房间` : ''
                            ) + `，${(2 * toward + 3) % 12}点方向\t` : '    '
                        )
                    );
                }
                game.onExit = (num) => {
                    if (num) {
                        console.log(`恭喜你找到了出口，但你需要找到剩下的${num}个目标才能离开`);
                    } else {
                        console.log('\n你成功脱离了迷宫，恭喜！\n');
                        // todo 结束
                        start();
                    }
                }
                if (withTip) {
                    // 地图，#为墙，/\-为锁住的门，O为目标，E为出口
                    //    #-E-#-#
                    //   #     O #
                    //  #-\-/- -/-#
                    // # O     |   #
                    //  #-/-\- -\-#
                    //   #   | O #
                    //    #-#-#-#
                    let map = '';
                    // 特征
                    // -------------row-
                    // | \     | \
                    // |   \-c |   \
                    // |   +c\ |   -a\
                    // |---------------|
                    // | \     | \ +a  |
                    // |   \ -b|+b \   |
                    // col   \ |     \ |
                    // |       ---------
                    // (11点方向(0) => 3点方向(2)): toward + 2;
                    const checks = [
                        ['>=', '>', '<'],
                        ['>', '>', '>='],
                        ['>', '<=', '>'],
                        ['<=', '<', '>'],
                        ['<', '<', '<='],
                        ['<', '>=', '<'],
                    ];
                    function roomFromCoord(row, col) {
                        const flags = [col - size + 1, row - size + 1, col - row];
                        let area = 0;
                        for (area in checks) {
                            if (checks[area].reduce((pass, symbol, index) => eval(flags[index] + symbol + '0') ? pass : false, true)) {
                                break;
                            }
                        }
                        const circle = Math.abs(flags[[1, 0, 2, 1, 0, 2,][area]]);
                        const index = Math.abs(flags[[0, 2, 1, 0, 2, 1,][area]]);
                        return game.board.getRoom(circle, area, index);
                    }
                    {
                        let side = 2 * size - 1, start = 1 - size, end = size;
                        for (let col = 0; col < side; col++) {
                            let top = '';
                            let center = charFromDoor(roomFromCoord(start > 0 ? start : 0, col), 3, ['#', 'E', '|', ' ']);
                            let bottom = '';
                            for (let row = start > 0 ? start : 0; row < (end < side ? end : side); row++) {
                                const room = roomFromCoord(row, col);
                                if (start <= 0) {
                                    top += '-' + charFromDoor(room, 4, ['#', 'E', '/', ' ']) + '-' + charFromDoor(room, 5, ['#', 'E', '\\', ' ']);
                                }
                                center += ' ' + (game.board.targets.has(room) ? 'O' : ' ') + ' ' + charFromDoor(room, 0, ['#', 'E', '|', ' ']);
                                if (start >= 0) {
                                    bottom += '-' + charFromDoor(room, 2, ['#', 'E', '\\', ' ']) + '-' + charFromDoor(room, 1, ['#', 'E', '/', ' ']);
                                }
                            }
                            const space = new Array(2 * Math.abs(start) + 1).join(' ');
                            if (top) {
                                map += space + ' ' + top.slice(1) + '\n';
                            }
                            map += space + center + '\n';
                            if (bottom) {
                                map += space + ' ' + bottom.slice(1) + '\n';
                            }
                            start++;
                            end++;
                        }
                    }
                    console.log(map);
                }
                console.log("游戏开始\n您可以使用左右箭头转向，使用上下箭头移动输入'/help'来查看帮助\n祝您一路顺风")
            }
            game = new Game(size, num, factor, binder);
        }).catch(console.trace);
    }
    start();
    // 初始化命令
    {
        const commands = {};
        let helpInfo = '[Commands]\n';
        for (let [key, func, tip] of [
            ['/help', () => { console.log(helpInfo); }, '查看帮助信息'],
            ['/replay', start, '重新开始'],
            ['/exit', () => {
                console.log('Bye.');
                process.exit(0);
            }, '退出游戏']
        ]) {
            commands[key] = func;
            helpInfo += `\t${key}: ${tip}\n`;
        }
        rl.on('line', (line) => {
            console.log('');
            line.startsWith('/') && (commands[line] ? commands[line]() : console.log('未知的命令'));
        });
    }
    // 配置按键操作
    {
        let operators = {
            get up() { return game.forward.bind(game); },
            get down() { return game.backword.bind(game); },
            get left() { return game.turnLeft.bind(game); },
            get right() { return game.turnRight.bind(game); },
            get w() { return operators.up; },
            get s() { return operators.down; },
            get a() { return operators.left; },
            get d() { return operators.right; },
            '/': () => {
                const _operators = operators;
                operators = { 'return': () => operators = _operators }
            }
        };
        process.stdin.on('keypress', (key, { name }) => game && operators[name || key] && operators[name || key]());
    }
}
const d = domain.create();
d.on('error', function (err) {
    console.error(err);
});
d.run(() => main());