class Room {
    // coord: [circle, area, index]
    constructor(coord) {
        // 门, 准确的说是door后面的room
        this.doors = new Array(6);
        // 锁，true为锁住，undefined为边界（后面没room），false为开启
        this.locks = new Array(6);
        this.coord = coord;
    }
}

class Board {
    constructor(size, num, factor) {
        const board = [[new Room([0, 0, 0])]];
        // 坐标房间公式：board[circle][area * circle + index]
        // 参数取值范围：circle[0, size); area[0, 6); index[0, circle)
        this.getRoom = (circle, area, index) => {
            return board[circle][area * circle + index];
        };
        // 连通房间
        function connect(room, sideRoom, door) {
            const sideDoor = (door + 3) % 6;
            room.doors[door] = sideRoom;
            sideRoom.doors[sideDoor] = room;
            room.locks[door] = sideRoom.locks[sideDoor] = Math.random() < factor ? true : false;
        }
        for (let circle = 1; circle < size; circle++) {
            const rooms = [];
            board.push(rooms);
            for (let area = 0; area < 6; area++) {
                // 转角房间
                {
                    const room = new Room([circle, area, 0]);
                    rooms.push(room);
                    area && connect(room, rooms[rooms.length - 2], (area + 6 - 2) % 6);
                    connect(room, board[circle - 1][area * (circle - 1)], (area + 3) % 6);
                }
                const lastDoorIndex = (area + 6 - 1) % 6;
                const insideDoorIndexs = [(area + 3) % 6, (area + 4) % 6];
                for (let index = 1; index < circle; index++) {
                    // 边上的房间
                    const room = new Room([circle, area, index]);
                    rooms.push(room);
                    connect(room, rooms[rooms.length - 2], lastDoorIndex);
                    connect(room, board[circle - 1][(area * (circle - 1) + index) % board[circle - 1].length], insideDoorIndexs[0]);
                    connect(room, board[circle - 1][area * (circle - 1) + index - 1], insideDoorIndexs[1]);
                }
            }
            // 首尾相接
            connect(rooms[0], rooms[rooms.length - 1], 4);
        }
        // 生成目标
        this.targets = new Map();
        {
            let areaArr = new Array(6).fill(null).map((_, i) => i);
            for (let index = 0; index < num; index++) {
                const randIndex = parseInt(Math.random() * areaArr.length);
                this.targets.set(board[size - 1][areaArr[randIndex] * (size - 1) + parseInt(Math.random() * (size - 1))], true);
                areaArr = areaArr.slice(0, randIndex).concat(areaArr.slice(randIndex + 1));
            }
        }
        // 生成出口
        const exitRoom = board[size - 1][parseInt(Math.random() * 6 * (size - 1))];
        {
            const outsideDoors = [];
            for (let door = 0; door < exitRoom.doors.length; door++) {
                exitRoom.doors[door] === undefined && outsideDoors.push(door);
            }
            exitRoom.doors[outsideDoors[parseInt(Math.random() * outsideDoors.length)]] = 'EXIT';
        }
        // 生成道路
        {
            const targets = new Map(this.targets);
            targets.set(exitRoom, true);
            // 遍历连通房间
            function visit(connectedMap, room) {
                if (connectedMap.has(room)) {
                    return;
                }
                connectedMap.set(room, true);
                targets.has(room) && targets.delete(room);
                room.locks.forEach((isLock, door) => isLock === false && visit(connectedMap, room.doors[door]));
                return connectedMap;
            }
            const connectedMaps = [visit(new Map(), board[0][0])];
            for (let [target, _] of targets) {
                connectedMaps.push(visit(new Map(), target));
            }
            while (connectedMaps.length > 1) {
                const connectedMap = connectedMaps.pop();
                let connectedArr = [];
                for (let [room, isJoin] of connectedMap) {
                    isJoin && connectedArr.push([room, Math.random()]);
                }
                connectedArr.sort((l, r) => l[1] - r[1]);
                while (connectedMap.size) {
                    const randIndex = parseInt(Math.random() * connectedArr.length);
                    let room = connectedArr[randIndex][0];
                    if (!connectedMap.get(room)) {
                        continue;
                    }
                    const preUnlocks = [];
                    if (room.locks.reduce((ignore, isLock, door) => {
                        if (isLock === true && !connectedMap.has(room.doors[door])) {
                            preUnlocks.push(door);
                            return false;
                        }
                        return ignore;
                    }, true)) {
                        // 该room拆墙无用，从当前加入的队列移除，并且今后不再加入
                        connectedArr = connectedArr.slice(0, randIndex).concat(connectedArr.slice(randIndex + 1));
                        connectedMap.set(room, false);
                        continue;
                    }
                    const door = preUnlocks[parseInt(Math.random() * preUnlocks.length)];
                    const sideRoom = room.doors[door];
                    sideRoom.locks[(door + 3) % 6] = room.locks[door] = false;
                    connectedMap.set(sideRoom, true);
                    connectedArr.push([sideRoom, null]);
                    for (let map of connectedMaps) {
                        if (map.has(sideRoom)) {
                            for (let [room, _] of connectedMap) {
                                map.set(room, true);
                            }
                            connectedMap.clear();
                            break;
                        }
                    }
                }
            }
        }
        // 玩家所在房间
        this.now = board[0][0];
    }
    // 玩家移动
    // index: 打开第几个门（当前所在房间的）[0, 5]
    move(index) {
        if (this.now.locks[index]) {
            return false;
        }
        const room = this.now.doors[index];
        if (!room) {
            return false;
        }
        if (room instanceof Room) {
            this.now = room;
        }
        return room;
    }
}
class Game {
    constructor(size, num, factor, binder) {
        this.board = new Board(size, num, factor);
        this.toward = 0;
        binder(this);
        this.onMove(this.board.now, this.toward);
    }
    openDoor(toward) {
        const room = this.board.move(toward);
        if (room instanceof Room) {
            // 进入房间
            this.onOpen(this.board.now, this.toward);
            if (this.board.targets.has(room)) {
                this.board.targets.delete(room);
                this.onFind(this.board.targets.size);
            }
            this.onMove(this.board.now, this.toward);
        } else if (room == 'EXIT') {
            // 找到出口
            this.onExit(this.board.targets.size);
        } else {
            // 不能通行
            this.onLock(this.board.now, this.toward);
        }
    }
    forward() {
        this.openDoor(this.toward);
    }
    backword() {
        this.openDoor((this.toward + 3) % 6);
    }
    turnLeft() {
        this.toward = (this.toward + 5) % 6;
        this.onMove(this.board.now, this.toward);
    }
    turnRight() {
        this.toward = (this.toward + 1) % 6;
        this.onMove(this.board.now, this.toward);
    }
    // room: 当前所在房间
    // toward: 当前朝向，取值[0, 6)
    onMove(room, toward) {
        // abstract
    }
    // 成功打开门
    onOpen(room, toward) {
        // abstract
    }
    // 找到了目标
    onFind(num) {
        // abstract
    }
    // 门被锁住了
    onLock(room, toward) {
        // abstract
    }
    // num: 剩余目标数量
    onExit(num) {
        // abstract
    }
    static get info() { return 'Honeycomb maze game, by: zhengxiaoyao0716.'; }
}

module.exports = exports = Game;
