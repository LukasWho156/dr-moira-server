/**
 * This is gonna be a pretty simple game with deliberately limited features,
 * so we're gonna keep all the logic in this simple file and don't do any of
 * those fancy abstractions computer scietists love so much.
 */
import { UndoSystem } from "./undo-system.js";
const DIRECTIONS = Object.freeze({
    UP: 1,
    LEFT: 3,
    RIGHT: 5,
    DOWN: 7,
});
class Level extends EventTarget {
    staticMap;
    pills;
    dependencies = [];
    viruses;
    floorThreshold;
    get width() {
        return this.staticMap[0].length;
    }
    get height() {
        return this.staticMap.length;
    }
    turnNumber = 0;
    undoSystem;
    get won() {
        return !this.viruses.find(v => v.active);
    }
    constructor(def) {
        super();
        this.floorThreshold = def.floorThreshold;
        this.staticMap = def.map;
        this.viruses = def.viruses.map((virus, i) => ({
            id: i,
            active: true,
            x: virus.x,
            y: virus.y,
            z: virus.z,
            color: virus.color,
            isExploding: false,
        }));
        this.pills = def.pills.map((pill, i) => ({
            id: i,
            active: true,
            x: pill.x,
            y: pill.y,
            z: pill.z,
            color: pill.color,
            playerControlled: pill.playerControlled,
            movement: {
                dx: 0,
                dy: 0,
                dz: 0,
                isMoving: false,
                dependencies: [],
            },
            isExploding: false,
        }));
        def.pills.forEach((pill, i) => {
            if (pill.connectedTo) {
                const connection = this.pills.find(p => {
                    return p.x === pill.connectedTo.x && p.y === pill.connectedTo.y && p.z === pill.connectedTo.z;
                });
                this.pills[i].connectedTo = connection?.id;
            }
        });
        this.undoSystem = new UndoSystem(this);
    }
    isWallAt = (x, y, z) => {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return true;
        }
        return this.staticMap[y][x] >= z;
    };
    getPillAt = (x, y, z) => {
        for (const pill of this.pills) {
            if (pill.active && pill.x === x && pill.y === y && pill.z === z) {
                return pill;
            }
        }
        return null;
    };
    getVirusAt = (x, y, z) => {
        for (const virus of this.viruses) {
            if (virus.active && virus.x === x && virus.y === y && virus.z === z) {
                return virus;
            }
        }
        return null;
    };
    tileHasColor = (color, x, y, z) => {
        const virus = this.getVirusAt(x, y, z);
        if (!!virus) {
            return (virus.color === color);
        }
        const pill = this.getPillAt(x, y, z);
        if (!!pill) {
            return (pill.color === color);
        }
        return false;
    };
    takeSnapshot = () => {
        const pillSnapshots = this.pills.map(pill => ({
            id: pill.id,
            active: pill.active,
            x: pill.x,
            y: pill.y,
            z: pill.z,
        }));
        const virusSnapshots = this.viruses.map(virus => ({
            id: virus.id,
            active: virus.active,
        }));
        return {
            pills: pillSnapshots,
            viruses: virusSnapshots,
            turnNumber: this.turnNumber,
        };
    };
    revertToState = (state) => {
        for (const vs of state.viruses) {
            this.viruses[vs.id].active = vs.active;
        }
        for (const ps of state.pills) {
            const pill = this.pills[ps.id];
            pill.active = ps.active;
            pill.x = ps.x;
            pill.y = ps.y;
            pill.z = ps.z;
        }
        this.turnNumber = state.turnNumber;
    };
    explodeTile = (x, y, z) => {
        const virus = this.getVirusAt(x, y, z);
        if (!!virus) {
            virus.isExploding = true;
            return;
        }
        const pill = this.getPillAt(x, y, z);
        if (!!pill) {
            pill.isExploding = true;
        }
    };
    resetMovement = () => {
        for (const pill of this.pills) {
            pill.movement.dx = 0;
            pill.movement.dy = 0;
            pill.movement.dz = 0;
            pill.movement.isMoving = false;
            pill.movement.dependencies.splice(0, pill.movement.dependencies.length);
            pill.isExploding = false;
        }
        for (const virus of this.viruses) {
            virus.isExploding = false;
        }
    };
    propagateMovement = (pill, dx, dy, dz) => {
        // Pill is already moving, so cancel
        if (pill.movement.isMoving) {
            return true;
        }
        const targetX = pill.x + dx;
        const targetY = pill.y + dy;
        const targetZ = pill.z + dz;
        // Check if there's a wall or virus in the way
        if (this.isWallAt(targetX, targetY, targetZ)) {
            return false;
        }
        if (!!this.getVirusAt(targetX, targetY, targetZ)) {
            return false;
        }
        pill.movement.dx = dx;
        pill.movement.dy = dy;
        pill.movement.dz = dz;
        // for the moment, pretend movement was successful, so we don't end up in
        // endless loops when recursing.
        pill.movement.isMoving = true;
        // Is a pill blocking movement?
        const blocker = this.getPillAt(targetX, targetY, targetZ);
        if (!!blocker) {
            blocker.movement.dependencies.push(pill.id);
            this.dependencies.push(blocker);
            // Try to do a push
            if (pill.playerControlled) {
                this.propagateMovement(blocker, dx, dy, dz);
            }
        }
        // finally, check if the pill is connected to another pill.
        if (pill.connectedTo !== undefined && pill.connectedTo !== null && this.pills[pill.connectedTo].active === true) {
            this.propagateMovement(this.pills[pill.connectedTo], dx, dy, dz);
            this.dependencies.push(this.pills[pill.connectedTo]);
        }
        // looks like the pill is free to move! Nice!
        return true;
    };
    recedeMovement = () => {
        while (this.dependencies.length > 0) {
            const pill = this.dependencies.shift();
            if (pill.movement.isMoving || !pill.active) {
                continue;
            }
            if (pill.connectedTo !== undefined && pill.connectedTo !== null && this.pills[pill.connectedTo].movement.isMoving) {
                this.pills[pill.connectedTo].movement.isMoving = false;
                this.dependencies.push(this.pills[pill.connectedTo]);
            }
            for (const d of pill.movement.dependencies) {
                if (this.pills[d].movement.isMoving) {
                    this.pills[d].movement.isMoving = false;
                    this.dependencies.push(this.pills[d]);
                }
            }
        }
    };
    performMovement = (isReplay) => {
        for (const pill of this.pills) {
            if (!pill.movement.isMoving) {
                continue;
            }
            pill.x += pill.movement.dx;
            pill.y += pill.movement.dy;
            pill.z += pill.movement.dz;
            pill.movement.isMoving = false;
            this.dispatchEvent(new CustomEvent('pillMoved', {
                detail: {
                    pill: pill,
                    dx: pill.movement.dx,
                    dy: pill.movement.dy,
                    dz: pill.movement.dz,
                    isReplay: isReplay,
                    turnNumber: this.turnNumber,
                }
            }));
        }
    };
    checkExplosionRoot = (root) => {
        const rX = root.x;
        const rY = root.y;
        const rZ = root.z;
        const color = root.color;
        let someExplosion = false;
        let explode = true;
        for (let dx = 1; dx <= 3; dx++) {
            if (!this.tileHasColor(color, rX + dx, rY, rZ)) {
                explode = false;
                break;
            }
        }
        if (explode) {
            someExplosion = true;
            for (let dx = 0; dx <= 3; dx++) {
                this.explodeTile(rX + dx, rY, rZ);
            }
        }
        explode = true;
        for (let dy = 1; dy <= 3; dy++) {
            if (!this.tileHasColor(color, rX, rY + dy, rZ)) {
                explode = false;
                break;
            }
        }
        if (explode) {
            someExplosion = true;
            for (let dy = 0; dy <= 3; dy++) {
                this.explodeTile(rX, rY + dy, rZ);
            }
        }
        explode = true;
        for (let dz = 1; dz <= 3; dz++) {
            if (!this.tileHasColor(color, rX, rY, rZ + dz)) {
                explode = false;
                break;
            }
        }
        if (explode) {
            someExplosion = true;
            for (let dz = 0; dz <= 3; dz++) {
                this.explodeTile(rX, rY, rZ + dz);
            }
        }
        return someExplosion;
    };
    performExplosions = (isReplay) => {
        for (const virus of this.viruses) {
            if (virus.isExploding) {
                virus.isExploding = false;
                virus.active = false;
                this.dispatchEvent(new CustomEvent('objectExploded', {
                    detail: {
                        targetType: 'virus',
                        target: virus,
                        isReplay: isReplay,
                        turnNumber: this.turnNumber,
                    }
                }));
            }
        }
        for (const pill of this.pills) {
            if (pill.isExploding) {
                pill.isExploding = false;
                pill.active = false;
                this.dispatchEvent(new CustomEvent('objectExploded', {
                    detail: {
                        targetType: 'pill',
                        target: pill,
                        isReplay: isReplay,
                        turnNumber: this.turnNumber,
                    }
                }));
            }
        }
    };
    takeGravityTurn = (isReplay) => {
        this.resetMovement();
        for (const pill of this.pills) {
            this.propagateMovement(pill, 0, 0, -1);
        }
        this.recedeMovement();
        let successful = false;
        for (const pill of this.pills) {
            successful = pill.movement.isMoving || successful;
        }
        if (!successful) {
            this.takeExplosionTurn(isReplay);
            return;
        }
        this.turnNumber += 1;
        this.performMovement(isReplay);
        this.takeGravityTurn(isReplay);
    };
    takeExplosionTurn = (isReplay) => {
        let someExplosion = false;
        for (const virus of this.viruses) {
            if (!virus.active) {
                continue;
            }
            someExplosion = this.checkExplosionRoot(virus) || someExplosion;
        }
        for (const pill of this.pills) {
            if (!pill.active) {
                continue;
            }
            someExplosion = this.checkExplosionRoot(pill) || someExplosion;
        }
        if (!someExplosion) {
            return;
        }
        this.turnNumber += 1;
        this.performExplosions(isReplay);
        this.takeGravityTurn(isReplay);
    };
    takeMovementTurn = (dx, dy, isReplay) => {
        this.resetMovement();
        for (const pill of this.pills) {
            if (!pill.playerControlled || !pill.active) {
                continue;
            }
            this.propagateMovement(pill, dx, dy, 0);
        }
        this.recedeMovement();
        let successful = false;
        for (const pill of this.pills) {
            successful = pill.movement.isMoving || successful;
        }
        if (!successful) {
            return false;
        }
        //this.pillsCopy.sort((a, b) => ((b.x * dx + b.y * dy) - (a.x * dx + a.y * dy)) + 100 * (a.z - b.z));
        let changed = true;
        while (changed) {
            changed = false;
            for (const pill of this.pills) {
                if (!pill.active || pill.movement.isMoving) {
                    continue;
                }
                const floor = this.getPillAt(pill.x, pill.y, pill.z - 1);
                if (!floor) {
                    continue;
                }
                if (!floor.movement.isMoving && floor != this.pills[pill.connectedTo]) {
                    continue;
                }
                if (pill.connectedTo !== undefined && this.pills[pill.connectedTo].active) {
                    const p2 = this.pills[pill.connectedTo];
                    if (this.isWallAt(p2.x, p2.y, p2.z - 1)) {
                        continue;
                    }
                    if (this.getVirusAt(p2.x, p2.y, p2.z - 1)) {
                        continue;
                    }
                    const f2 = this.getPillAt(p2.x, p2.y, p2.z - 1);
                    if (!!f2 && f2 !== pill) {
                        if (!f2.movement.isMoving) {
                            continue;
                        }
                    }
                }
                floor.movement.dependencies.push(pill.id);
                this.dependencies.push(pill);
                changed = this.propagateMovement(pill, dx, dy, 0) || changed;
            }
        }
        this.recedeMovement();
        this.turnNumber += 1;
        this.performMovement(isReplay);
        this.takeGravityTurn(isReplay);
        return true;
    };
    checkForWin = () => {
        if (!this.viruses.find(v => v.active)) {
            this.dispatchEvent(new CustomEvent('won', { detail: {
                    moves: this.undoSystem.currentHistory(),
                } }));
        }
    };
    processInput = (input, isReplay) => {
        let dy = Math.floor(input / 3) - 1;
        let dx = (input % 3) - 1;
        return this.takeMovementTurn(dx, dy, isReplay);
    };
    input = (input) => {
        this.undoSystem.do(input);
        this.checkForWin();
    };
    undo = () => {
        this.undoSystem.undo();
        this.dispatchEvent(new CustomEvent('redo'));
    };
    redo = () => {
        this.undoSystem.redo();
        this.dispatchEvent(new CustomEvent('undo'));
    };
    restart = () => {
        this.undoSystem.restart();
        this.dispatchEvent(new CustomEvent('restart'));
    };
    currentHistory = () => {
        return this.undoSystem.currentHistory();
    };
}
export { Level, DIRECTIONS };
